// Vet Network — matches an owner to an approved vet in the origin country and
// books the forward procedures (microchip, primary rabies, titer draw if
// required, OV endorsement appointment). Reads the compliance verdict to
// understand what the vet actually needs to do; never reinterprets rules.

import { type AgentDefinition, validateAgent } from "./types";

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved vet near their residence and books the forward procedures (microchip, primary rabies, titer, OV endorsement appointment).",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "read_assessment",
      description: "Read the latest compliance assessment to see which forward procedures the vet needs to perform.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "list_approved_vets",
      description: "List approved vets in the origin country, optionally filtered by city and the procedures they are credentialed for.",
      input_schema: {
        type: "object",
        properties: {
          country_code: { type: "string" },
          city: { type: "string" },
          required_capabilities: {
            type: "array",
            items: {
              type: "string",
              enum: ["microchip", "rabies_primary", "rabies_booster", "titer_draw", "health_cert", "ov_endorsement"],
            },
          },
        },
        required: ["country_code"],
      },
    },
    {
      name: "propose_appointment",
      description: "Terminal: propose a concrete appointment slot. The orchestrator will relay to Comms for owner confirmation. Dates are ISO YYYY-MM-DD; time is HH:MM in the vet's local tz.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          procedures: {
            type: "array",
            items: {
              type: "string",
              enum: ["microchip", "rabies_primary", "rabies_booster", "titer_draw", "health_cert", "ov_endorsement"],
            },
            minItems: 1,
          },
          proposed_date: { type: "string", description: "ISO YYYY-MM-DD" },
          proposed_time: { type: "string", description: "HH:MM in the vet's local timezone" },
          cited_rules: {
            type: "array",
            items: { type: "string" },
            description: "Requirement codes from the assessment that justify this booking.",
          },
        },
        required: ["case_id", "vet_id", "procedures", "proposed_date", "cited_rules"],
      },
    },
    {
      name: "request_owner_input",
      description: "Terminal: ask the owner for info needed to book (preferred city, availability window). Routes through Comms.",
      input_schema: {
        type: "object",
        properties: {
          field: { type: "string" },
          question: { type: "string" },
        },
        required: ["field", "question"],
      },
    },
    {
      name: "no_eligible_vet",
      description: "Terminal: no approved vet in the owner's region can perform the required procedures within the compliance window. Escalates to human.",
      input_schema: {
        type: "object",
        properties: {
          reason: { type: "string" },
          missing_capability: { type: "string" },
        },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: ["propose_appointment", "request_owner_input", "no_eligible_vet"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
