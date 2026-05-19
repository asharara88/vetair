// Vet Network — matches an owner to an approved clinic for the procedures the
// assessment says are still pending (microchip, vaccine, titer, endorsement
// signing). Proposes appointment dates that the consensus loop can stitch
// together with the airline + endorsement timing windows.

import { type AgentDefinition, validateAgent } from "./types";
import {
  ACKNOWLEDGE_AND_WAIT_TOOL,
  READ_ASSESSMENT_TOOL,
  READ_CASE_TOOL,
} from "./shared-tools";

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved clinic and proposes appointment dates for the procedures the assessment flagged as pending.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    READ_CASE_TOOL,
    READ_ASSESSMENT_TOOL,
    {
      name: "find_partner_vets",
      description:
        "List partner clinics that can perform a given procedure within reach of the owner's residence.",
      input_schema: {
        type: "object",
        properties: {
          city: { type: "string" },
          country: { type: "string" },
          procedure: {
            type: "string",
            enum: ["microchip", "rabies_primary", "rabies_booster", "titer", "health_cert_endorsement"],
          },
          radius_km: { type: "integer", minimum: 1, maximum: 200 },
        },
        required: ["country", "procedure"],
      },
    },
    {
      name: "read_vet_availability",
      description:
        "Read open appointment slots for a partner clinic within a date window.",
      input_schema: {
        type: "object",
        properties: {
          clinic_id: { type: "string" },
          procedure: { type: "string" },
          window_start: { type: "string", description: "ISO date (YYYY-MM-DD), inclusive." },
          window_end:   { type: "string", description: "ISO date (YYYY-MM-DD), inclusive." },
        },
        required: ["clinic_id", "procedure", "window_start", "window_end"],
      },
    },
    {
      name: "propose_vet_plan",
      description:
        "Terminal: emit a proposed appointment plan to the consensus round. One entry per pending procedure. Use only clinic_ids returned by find_partner_vets and slots from read_vet_availability.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          appointments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                procedure: { type: "string" },
                clinic_id: { type: "string" },
                proposed_date: { type: "string", description: "ISO date (YYYY-MM-DD)." },
                requirement_codes: {
                  type: "array",
                  items: { type: "string" },
                  description: "requirement_codes this appointment satisfies.",
                },
              },
              required: ["procedure", "clinic_id", "proposed_date", "requirement_codes"],
            },
            minItems: 1,
          },
        },
        required: ["case_id", "appointments"],
      },
    },
    {
      name: "no_partner_available",
      description:
        "Terminal: no partner clinic in the registry can perform this procedure within the required window. Escalates to the orchestrator.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          procedure: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "procedure", "reason"],
      },
    },
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: ["propose_vet_plan", "no_partner_available", "acknowledge_and_wait"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
