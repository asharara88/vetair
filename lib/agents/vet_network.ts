// Vet Network — matches the case to an approved partner vet and books the
// procedure ladder (microchip implant, vaccines, titer test, endorsement).
// Outputs a `proposed_schedule[]` whose dates the orchestrator hands to the
// consensus timeline loop alongside Airline & Crate and Endorsement.

import { type AgentDefinition, validateAgent } from "./types";

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved partner vet and proposes appointment dates for the procedure ladder (microchip / vaccine / titer / endorsement).",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "list_partner_vets",
      description: "List approved partner vets near a city, with capabilities and earliest available slots.",
      input_schema: {
        type: "object",
        properties: {
          country: { type: "string" },
          city: { type: "string" },
          capabilities: {
            type: "array",
            items: {
              type: "string",
              enum: ["microchip", "rabies_vaccine", "titer_test", "endorsement", "health_certificate"],
            },
          },
        },
        required: ["country", "city"],
      },
    },
    {
      name: "read_pet_facts",
      description: "Read the pet row for the case (species, breed, weight, microchip status, vaccination history).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_assessment",
      description: "Read the most recent compliance assessment to learn which procedures are still missing.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "check_slot_availability",
      description: "Confirm a candidate appointment slot is still open at a partner vet.",
      input_schema: {
        type: "object",
        properties: {
          vet_id: { type: "string" },
          procedure: {
            type: "string",
            enum: ["microchip", "rabies_vaccine", "titer_test", "endorsement", "health_certificate"],
          },
          proposed_at: { type: "string", description: "ISO-8601 timestamp." },
        },
        required: ["vet_id", "procedure", "proposed_at"],
      },
    },
    {
      name: "propose_schedule",
      description:
        "Terminal: emit an ordered list of vet appointments for the consensus timeline round. Order must respect dependencies (microchip before vaccine, vaccine before titer where required, endorsement window relative to flight).",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          proposed_schedule: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                step: { type: "integer", minimum: 1 },
                procedure: {
                  type: "string",
                  enum: ["microchip", "rabies_vaccine", "titer_test", "endorsement", "health_certificate"],
                },
                vet_id: { type: "string" },
                vet_name: { type: "string" },
                proposed_at: { type: "string", description: "ISO-8601 timestamp." },
                requirement_code: {
                  type: "string",
                  description: "Cite the country_rule that drives this appointment's timing.",
                },
                notes: { type: "string" },
              },
              required: ["step", "procedure", "vet_id", "proposed_at", "requirement_code"],
            },
          },
        },
        required: ["case_id", "proposed_schedule"],
      },
    },
    {
      name: "no_partner_vet_available",
      description:
        "Terminal: no approved partner vet covers this corridor + capability set. Escalate to human routing.",
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
  terminal_tools: ["propose_schedule", "no_partner_vet_available"],
  budget: { max_turns: 5, max_input_tokens: 30_000 },
});
