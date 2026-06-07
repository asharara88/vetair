// Vet Network — matches owner to an approved vet and books the required
// procedures (microchip, vaccine, titer, OV endorsement appointment).
// Outputs proposed dates into the consensus timeline loop; never books
// unilaterally — the orchestrator confirms feasibility first.

import { type AgentDefinition, validateAgent } from "./types";
import { ASK_USER_FOR_INPUT_TOOL } from "./shared-tools";

const PROCEDURE_KINDS = [
  "microchip",
  "rabies_vaccine",
  "rabies_titer",
  "dhpp_vaccine",
  "fvrcp_vaccine",
  "ov_endorsement",
  "health_check",
] as const;

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved vet in the residence country and proposes appointment dates for the required procedures. Outputs feed the consensus timeline loop.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "list_vets",
      description:
        "List approved vets in a residence country, optionally filtered by city. Returns name, address, specialties[], next_availability ISO dates.",
      input_schema: {
        type: "object",
        properties: {
          residence_country: { type: "string" },
          city: { type: "string" },
        },
        required: ["residence_country"],
      },
    },
    {
      name: "read_required_procedures",
      description:
        "Read the per-case set of procedures still required, derived from the latest compliance assessment's requirements_missing.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "check_availability",
      description:
        "Check next available slots for a procedure at a specific vet. Returns up to 5 slot ISO timestamps.",
      input_schema: {
        type: "object",
        properties: {
          vet_id: { type: "string" },
          procedure: { type: "string", enum: [...PROCEDURE_KINDS] },
          after_date: { type: "string", description: "ISO date — only show slots on or after this date." },
        },
        required: ["vet_id", "procedure"],
      },
    },
    {
      name: "propose_appointments",
      description:
        "Terminal: propose one or more appointments for the consensus timeline. Each appointment cites the requirement_code it satisfies. The orchestrator runs feasibility before any booking is confirmed.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          proposals: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                procedure: { type: "string", enum: [...PROCEDURE_KINDS] },
                slot: { type: "string", description: "ISO timestamp of the proposed appointment." },
                requirement_code: { type: "string" },
              },
              required: ["procedure", "slot", "requirement_code"],
            },
          },
        },
        required: ["case_id", "vet_id", "proposals"],
      },
    },
    {
      name: "confirm_booking",
      description:
        "Terminal: confirm an appointment after the orchestrator has cleared it. Use only on a previously proposed slot.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          procedure: { type: "string", enum: [...PROCEDURE_KINDS] },
          slot: { type: "string" },
          requirement_code: { type: "string" },
        },
        required: ["case_id", "vet_id", "procedure", "slot", "requirement_code"],
      },
    },
    ASK_USER_FOR_INPUT_TOOL,
    {
      name: "no_vet_available",
      description:
        "Terminal: no approved vet covers this residence country/city or no slot fits. Escalates to comms for a corridor or date conversation.",
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
  terminal_tools: [
    "propose_appointments",
    "confirm_booking",
    "ask_user_for_input",
    "no_vet_available",
  ],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
