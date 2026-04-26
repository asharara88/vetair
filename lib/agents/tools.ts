// Tool implementations for the Vetair MAS.
//
// The runtime calls one of these for every assistant tool_use block that
// isn't a terminal tool. Each function returns a string — the tool_result
// content fed back into the next turn. Terminal tools are intercepted by
// the runtime BEFORE reaching here; they end the loop.
//
// All tools are pure-ish: they read/write Supabase, call other services,
// and return a JSON string. They never throw — errors are returned as
// `{ error: "..." }` so the agent can recover or escalate.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolSchema } from "./types";

export type ToolImpl = (
  input: Record<string, unknown>,
  ctx: { supabase: SupabaseClient; caseId: string | null },
) => Promise<unknown>;

// ---------- shared helpers ----------

const ok = (data: unknown) => JSON.stringify(data);
const err = (message: string) => JSON.stringify({ error: message });

// ---------- read tools ----------

export const readCase: ToolImpl = async (_input, { supabase, caseId }) => {
  if (!caseId) return err("no case in context");
  const { data, error } = await supabase
    .from("cases")
    .select("id, case_number, origin_country, destination_country, target_date, state, demo_mode")
    .eq("id", caseId)
    .single();
  if (error) return err(error.message);
  return ok(data);
};

export const readPet: ToolImpl = async (_input, { supabase, caseId }) => {
  if (!caseId) return err("no case in context");
  const { data: caseRow, error: caseErr } = await supabase
    .from("cases").select("pet_id").eq("id", caseId).single();
  if (caseErr || !caseRow) return err(caseErr?.message ?? "case not found");
  const { data, error } = await supabase
    .from("pets")
    .select("id, name, species, breed, date_of_birth, weight_kg, microchip_id, microchip_implant_date")
    .eq("id", caseRow.pet_id)
    .single();
  if (error) return err(error.message);
  return ok(data);
};

export const listDocuments: ToolImpl = async (_input, { supabase, caseId }) => {
  if (!caseId) return err("no case in context");
  const { data, error } = await supabase
    .from("documents")
    .select("id, document_type, extracted_fields, extraction_confidence, verified")
    .eq("case_id", caseId);
  if (error) return err(error.message);
  return ok(data ?? []);
};

export const queryRules: ToolImpl = async (input, { supabase }) => {
  const origin = String(input.origin_country ?? "");
  const destination = String(input.destination_country ?? "");
  const species = String(input.species ?? "");
  if (!origin || !destination || !species) {
    return err("origin_country, destination_country, species all required");
  }
  const { data, error } = await supabase
    .from("country_rules")
    .select("id, requirement_code, requirement_type, title, evidence_schema, time_constraints, evaluator_fn_name, source_url, priority")
    .eq("origin_country", origin)
    .eq("destination_country", destination)
    .eq("species", species)
    .eq("is_active", true)
    .order("priority", { ascending: false });
  if (error) return err(error.message);
  return ok(data ?? []);
};

// ---------- write tools ----------

export const postAgentMessage: ToolImpl = async (input, { supabase, caseId }) => {
  if (!caseId) return err("no case in context");
  const target = String(input.to_agent ?? "");
  const kind = String(input.kind ?? "request");
  const payload = input.payload ?? {};
  if (!target) return err("to_agent required");

  const { data, error } = await supabase
    .from("agent_messages")
    .insert({
      case_id: caseId,
      from_agent: input.from_agent ?? null,
      to_agent: target,
      kind,
      payload,
    })
    .select("id")
    .single();
  if (error) return err(error.message);
  return ok({ message_id: data?.id });
};

export const updateCaseState: ToolImpl = async (input, { supabase, caseId }) => {
  if (!caseId) return err("no case in context");
  const next = String(input.state ?? "");
  if (!next) return err("state required");
  const patch: Record<string, unknown> = { state: next };
  if (typeof input.earliest_legal_departure === "string") {
    patch.earliest_legal_departure = input.earliest_legal_departure;
  }
  const { error } = await supabase.from("cases").update(patch).eq("id", caseId);
  if (error) return err(error.message);
  return ok({ updated: true, state: next });
};

// ---------- tool registry + manifests ----------

export const TOOLS: Record<string, ToolImpl> = {
  read_case: readCase,
  read_pet: readPet,
  list_documents: listDocuments,
  query_rules: queryRules,
  post_agent_message: postAgentMessage,
  update_case_state: updateCaseState,
};

// Reusable manifest fragments — any agent can import these and merge with its
// own terminal-tool manifest.
export const COMMON_READ_TOOLS: ToolSchema[] = [
  {
    name: "read_case",
    description: "Read the current case row (id, corridor, target date, state).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "read_pet",
    description: "Read the pet on the current case (species, breed, microchip, DOB).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_documents",
    description: "List documents uploaded on the current case with their extracted fields.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "query_rules",
    description: "Fetch the active country_rules for a corridor + species.",
    input_schema: {
      type: "object",
      properties: {
        origin_country: { type: "string", description: "ISO-3166 alpha-2, e.g. AE" },
        destination_country: { type: "string", description: "ISO-3166 alpha-2, e.g. GB" },
        species: { type: "string", enum: ["dog", "cat", "ferret"] },
      },
      required: ["origin_country", "destination_country", "species"],
    },
  },
];

export const POST_MESSAGE_TOOL: ToolSchema = {
  name: "post_agent_message",
  description:
    "Send a typed message to another agent on this case. Use kind='request' to ask for work, 'concur' to agree with a verdict, 'dissent' to challenge it.",
  input_schema: {
    type: "object",
    properties: {
      to_agent: { type: "string", description: "Target agent name (e.g. 'auditor', 'orchestrator')" },
      kind: { type: "string", enum: ["request", "concur", "dissent", "info"] },
      payload: { type: "object", description: "Free-form JSON the receiving agent expects" },
    },
    required: ["to_agent", "kind"],
  },
};

export const UPDATE_CASE_STATE_TOOL: ToolSchema = {
  name: "update_case_state",
  description: "Move the current case to a new state. Only Orchestrator should call this.",
  input_schema: {
    type: "object",
    properties: {
      state: {
        type: "string",
        enum: [
          "draft", "intake", "assessment", "blocked", "approved",
          "documentation", "vet_procedures", "booking", "transit",
          "arrived", "closed", "cancelled",
        ],
      },
      earliest_legal_departure: { type: "string", description: "ISO date YYYY-MM-DD" },
    },
    required: ["state"],
  },
};
