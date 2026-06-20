// Vet Network — books microchip / vaccine / titer / endorsement appointments.
// Reads the assessment, finds an approved vet near the owner, and returns the
// orchestrator a confirmed slot or a "no slot in window" failure to escalate.

import { type AgentDefinition, validateAgent } from "./types";
import { askUserForInputTool, caseIdInput } from "./tool-schemas";

const PROCEDURE_KINDS = [
  "microchip",
  "rabies_vaccine",
  "rabies_titer",
  "dhpp",
  "fvrcp",
  "health_certificate",
  "endorsement_visit",
] as const;

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network Team",
  description:
    "Matches the owner to an approved vet and books microchip / vaccine / titer / endorsement procedures within the corridor's legal window.",
  prompt_path: "lib/prompts/vet-network.md",
  tools: [
    {
      name: "read_assessment",
      description:
        "Read the most recent compliance assessment so the procedure plan respects every requirement_code.",
      input_schema: caseIdInput(),
    },
    {
      name: "read_owner_location",
      description:
        "Read the owner's current city / region / country so candidate vets can be filtered by proximity.",
      input_schema: caseIdInput(),
    },
    {
      name: "list_approved_vets",
      description:
        "Read the approved-vet directory, filtered by region and procedure capability. Only vets with `endorsing_authority=true` may sign export paperwork.",
      input_schema: {
        type: "object",
        properties: {
          region: { type: "string" },
          procedure: { type: "string", enum: [...PROCEDURE_KINDS] },
          requires_endorsement: { type: "boolean" },
        },
        required: ["region", "procedure"],
      },
    },
    {
      name: "check_vet_availability",
      description:
        "Query a vet's open slots inside the supplied date window. Window dates are ISO `YYYY-MM-DD`.",
      input_schema: {
        type: "object",
        properties: {
          vet_id: { type: "string" },
          procedure: { type: "string", enum: [...PROCEDURE_KINDS] },
          window_start: { type: "string" },
          window_end: { type: "string" },
        },
        required: ["vet_id", "procedure", "window_start", "window_end"],
      },
    },
    {
      name: "propose_booking",
      description:
        "Terminal: lock a tentative slot. Returns a `booking_id` the orchestrator can confirm with the owner. Does NOT charge or commit.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          procedure: { type: "string", enum: [...PROCEDURE_KINDS] },
          slot_start: { type: "string" },
          duration_minutes: { type: "integer", minimum: 15, maximum: 240 },
          quote_amount_usd: { type: "number", minimum: 0 },
          cited_rules: { type: "array", items: { type: "string" } },
        },
        required: [
          "case_id",
          "vet_id",
          "procedure",
          "slot_start",
          "duration_minutes",
          "quote_amount_usd",
          "cited_rules",
        ],
      },
    },
    askUserForInputTool,
    {
      name: "fail_booking",
      description:
        "Terminal: no feasible slot inside the legal window. Reason MUST cite the binding requirement_code and the earliest legal date so the orchestrator can replan.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          binding_requirement_code: { type: "string" },
          earliest_legal_date: { type: "string" },
        },
        required: ["case_id", "reason", "binding_requirement_code"],
      },
    },
  ],
  terminal_tools: ["propose_booking", "ask_user_for_input", "fail_booking"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
