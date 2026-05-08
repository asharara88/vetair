// Vet Network — matches owner to an approved vet and books the
// microchip / vaccine / titer / endorsement appointments. Participates in the
// timeline consensus loop by proposing feasible appointment dates.

import { type AgentDefinition, validateAgent } from "./types";
import { PROPOSE_DATES_TOOL } from "./shared-tools";

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches owner to an approved vet and books microchip / vaccine / titer / endorsement appointments. Proposes feasible dates into the timeline consensus loop.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "list_approved_vets",
      description: "List approved partner vets servicing a corridor + species, optionally near a lat/lng.",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string" },
          destination: { type: "string" },
          species: { type: "string" },
          lat: { type: "number" },
          lng: { type: "number" },
          radius_km: { type: "integer", minimum: 5, maximum: 200 },
        },
        required: ["origin", "destination", "species"],
      },
    },
    {
      name: "check_vet_availability",
      description: "Check appointment slots for a vet across an ISO date window.",
      input_schema: {
        type: "object",
        properties: {
          vet_id: { type: "string" },
          window_start: { type: "string", description: "ISO YYYY-MM-DD" },
          window_end: { type: "string", description: "ISO YYYY-MM-DD" },
          procedure: {
            type: "string",
            enum: ["microchip", "rabies_vaccine", "titer_test", "health_check", "endorsement_signoff"],
          },
        },
        required: ["vet_id", "window_start", "window_end", "procedure"],
      },
    },
    {
      name: "read_assessment",
      description: "Read the latest compliance assessment so you know which procedures are still required.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    PROPOSE_DATES_TOOL,
    {
      name: "book_appointment",
      description:
        "Terminal: lock an appointment slot. The booking is provisional until the orchestrator's consensus round confirms the timeline.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          procedure: {
            type: "string",
            enum: ["microchip", "rabies_vaccine", "titer_test", "health_check", "endorsement_signoff"],
          },
          appointment_at: { type: "string", description: "ISO timestamp" },
        },
        required: ["case_id", "vet_id", "procedure", "appointment_at"],
      },
    },
    {
      name: "escalate_no_capacity",
      description:
        "Terminal: no approved vet has capacity inside the case window. Orchestrator decides between widening the window or escalating to human.",
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
  terminal_tools: ["propose_dates", "book_appointment", "escalate_no_capacity"],
  budget: { max_turns: 6, max_input_tokens: 30_000 },
});
