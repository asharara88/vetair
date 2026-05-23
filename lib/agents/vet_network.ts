// Vet Network — matches an owner to an approved clinic in their city and
// queues the microchip / vaccine / titer / endorsement appointments. The V1
// implementation reads from `sim_vet_network` (curated demo catalog); a real
// booking integration plugs in behind the same tool surface.

import { type AgentDefinition, validateAgent } from "./types";

const APPOINTMENT_KINDS = [
  "microchip",
  "rabies_vaccine",
  "titer_test",
  "health_check",
  "endorsement",
] as const;

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network Team",
  description:
    "Matches the owner to an approved clinic in their city and queues the procedures the compliance assessment surfaced. Proposes dates that fit the corridor's endorsement window.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "list_vets",
      description:
        "List approved clinics for a country (and optionally a city). Reads sim_vet_network; only `is_active = true` rows.",
      input_schema: {
        type: "object",
        properties: {
          country_code: { type: "string" },
          city: { type: "string" },
          endorsement_certified: { type: "boolean" },
        },
        required: ["country_code"],
      },
    },
    {
      name: "read_assessment",
      description:
        "Read the most recent compliance assessment for the case so you know which procedures are missing.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "propose_appointment",
      description:
        "Propose a date for one appointment. Does not book — the orchestrator's consensus round confirms the timeline before booking.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          kind: { type: "string", enum: [...APPOINTMENT_KINDS] },
          proposed_date: { type: "string", description: "ISO date YYYY-MM-DD" },
          rationale: { type: "string" },
        },
        required: ["case_id", "vet_id", "kind", "proposed_date"],
      },
    },
    {
      name: "book_appointment",
      description:
        "Terminal: confirm a proposed appointment after consensus. Writes the booking and notifies the owner via Comms.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          kind: { type: "string", enum: [...APPOINTMENT_KINDS] },
          scheduled_date: { type: "string" },
        },
        required: ["case_id", "vet_id", "kind", "scheduled_date"],
      },
    },
    {
      name: "no_match_found",
      description:
        "Terminal: no approved clinic is available for the owner's city / certification. Escalates to the orchestrator with a reason.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: ["book_appointment", "no_match_found"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
