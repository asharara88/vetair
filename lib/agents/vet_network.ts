// Vet Network — matches an owner to an approved vet and books the procedures
// the compliance assessment listed as `requirements_missing`. Read-only on the
// rule graph; never reasons about compliance itself.

import { type AgentDefinition, validateAgent } from "./types";

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved vet in their city and books the procedures the compliance assessment flagged as missing.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "read_owner_location",
      description: "Read the owner's residence city/country so we only quote vets that can actually see them.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_assessment",
      description: "Read the most recent compliance assessment for a case to know what procedures the vet must perform.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "find_vets",
      description: "Query the approved vet roster filtered by city + procedure capability.",
      input_schema: {
        type: "object",
        properties: {
          city: { type: "string" },
          country: { type: "string" },
          capabilities: {
            type: "array",
            items: {
              type: "string",
              enum: ["microchip", "rabies_vaccine", "rabies_titer", "health_certificate", "endorsement_prep"],
            },
            minItems: 1,
          },
        },
        required: ["city", "country", "capabilities"],
      },
    },
    {
      name: "propose_appointment",
      description:
        "Terminal: propose a concrete vet + appointment window for the owner to confirm via Comms. Every procedure must trace back to a requirement_code from the assessment.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          earliest_window_start: { type: "string", description: "ISO date" },
          earliest_window_end: { type: "string", description: "ISO date" },
          procedures: {
            type: "array",
            items: {
              type: "object",
              properties: {
                procedure: {
                  type: "string",
                  enum: ["microchip", "rabies_vaccine", "rabies_titer", "health_certificate"],
                },
                requirement_code: { type: "string" },
              },
              required: ["procedure", "requirement_code"],
            },
            minItems: 1,
          },
        },
        required: ["case_id", "vet_id", "earliest_window_start", "earliest_window_end", "procedures"],
      },
    },
    {
      name: "no_vets_available",
      description:
        "Terminal: no approved vet covers this corridor / city / procedure mix. Escalates to Comms with a clear blocker.",
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
  terminal_tools: ["propose_appointment", "no_vets_available"],
  budget: { max_turns: 5, max_input_tokens: 30_000 },
});
