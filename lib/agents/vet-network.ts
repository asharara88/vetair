// Vet Network — matches owner to an approved vet and books the procedural
// chain (microchip / vaccine / titer / endorsement). Deterministic on slot
// availability; the Claude loop only proposes — booking writes a row.

import { type AgentDefinition, validateAgent } from "./types";

const PROCEDURE_KIND = [
  "microchip_implant",
  "rabies_vaccine",
  "rabies_titer",
  "dhpp_vaccine",
  "fvrcp_vaccine",
  "health_certificate",
  "pre_export_endorsement",
] as const;

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved vet and books the procedural chain (microchip, vaccines, titer, pre-export endorsement) within the deterministic timing window.",
  prompt_path: "lib/prompts/vet-network.md",
  tools: [
    {
      name: "list_approved_vets",
      description:
        "Read approved_vets near the owner's residence. Filter by city/emirate; never propose an unapproved clinic.",
      input_schema: {
        type: "object",
        properties: {
          city: { type: "string" },
          country: { type: "string" },
          procedures: {
            type: "array",
            items: { type: "string", enum: [...PROCEDURE_KIND] },
            description: "Procedures the clinic must offer.",
          },
        },
        required: ["country"],
      },
    },
    {
      name: "read_vet_availability",
      description:
        "Read open slots for a vet within a date range. Returns ISO-8601 timestamps already filtered against the case's earliest_legal_departure.",
      input_schema: {
        type: "object",
        properties: {
          vet_id: { type: "string" },
          window_start: { type: "string", description: "ISO-8601 date" },
          window_end: { type: "string", description: "ISO-8601 date" },
        },
        required: ["vet_id", "window_start", "window_end"],
      },
    },
    {
      name: "read_case_timing",
      description:
        "Read the case's deterministic timing window: target_date, earliest_legal_departure, endorsement window (7–10 days pre-flight).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "propose_appointment",
      description:
        "Stage a proposed appointment for the orchestrator's consensus round. Non-terminal — multiple proposals can coexist.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          procedure: { type: "string", enum: [...PROCEDURE_KIND] },
          starts_at: { type: "string", description: "ISO-8601 timestamp" },
          rationale: {
            type: "string",
            description: "Why this slot — e.g. 'lands inside 7-10d endorsement window'.",
          },
        },
        required: ["case_id", "vet_id", "procedure", "starts_at", "rationale"],
      },
    },
    {
      name: "book_appointment",
      description:
        "Terminal: confirm a proposed appointment. Writes vet_appointments row, dispatches Comms with the slot details.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          procedure: { type: "string", enum: [...PROCEDURE_KIND] },
          starts_at: { type: "string" },
        },
        required: ["case_id", "vet_id", "procedure", "starts_at"],
      },
    },
    {
      name: "fail_no_slot",
      description:
        "Terminal: no approved vet has a slot inside the deterministic window. Routes to orchestrator for consensus replan.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          procedure: { type: "string", enum: [...PROCEDURE_KIND] },
          window_start: { type: "string" },
          window_end: { type: "string" },
        },
        required: ["case_id", "procedure", "window_start", "window_end"],
      },
    },
  ],
  terminal_tools: ["book_appointment", "fail_no_slot"],
  budget: { max_turns: 6, max_input_tokens: 30_000 },
});
