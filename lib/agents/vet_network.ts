// Vet Network — matches owner to an approved partner clinic and books the
// pre-flight procedures (microchip, rabies, titer, endorsement appointment).

import { type AgentDefinition, validateAgent } from "./types";
import { ACKNOWLEDGE_AND_WAIT } from "./shared-tools";

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Books pre-flight procedures (microchip, rabies, titer, endorsement) at approved partner clinics. Reasons over geography, lead times, and the country rule timing constraints.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "list_partner_clinics",
      description:
        "Read approved clinics filtered by country + city. Returns lead time and supported procedures.",
      input_schema: {
        type: "object",
        properties: {
          country_code: { type: "string" },
          city: { type: "string" },
        },
        required: ["country_code"],
      },
    },
    {
      name: "read_assessment",
      description:
        "Read the most recent compliance assessment so you know which procedures are still required.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_procedure_history",
      description:
        "Read the case's existing vet procedures (microchip implant date, prior vaccinations, titer results).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "propose_appointment",
      description:
        "Terminal: write a proposed appointment to vet_appointments. Owner confirms via Comms before the booking is committed.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          clinic_id: { type: "string" },
          procedure: {
            type: "string",
            enum: ["microchip", "rabies_vaccine", "titer_test", "health_exam", "endorsement_visit"],
          },
          earliest_date: { type: "string", description: "ISO YYYY-MM-DD" },
          latest_date: { type: "string", description: "ISO YYYY-MM-DD" },
          cited_rules: {
            type: "array",
            items: { type: "string" },
            description: "Requirement codes that drove the timing constraints.",
          },
        },
        required: ["case_id", "clinic_id", "procedure", "earliest_date", "latest_date", "cited_rules"],
      },
    },
    {
      name: "no_clinic_available",
      description:
        "Terminal: no partner clinic in the owner's region supports the required procedure within the legal window. Escalates to Orchestrator.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
    ACKNOWLEDGE_AND_WAIT,
  ],
  terminal_tools: ["propose_appointment", "no_clinic_available", "acknowledge_and_wait"],
  budget: { max_turns: 5, max_input_tokens: 30_000 },
});
