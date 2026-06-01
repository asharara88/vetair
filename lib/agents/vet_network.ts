// Vet Network — matches owners to approved vets and books the pre-flight
// procedure chain (microchip, vaccine, titer, endorsement appointment). Also
// proposes candidate dates into the consensus loop driven by Orchestrator.

import { type AgentDefinition, validateAgent } from "./types";

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved vet, books microchip/vaccine/titer/endorsement, and proposes candidate dates into the consensus loop.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "list_approved_vets",
      description: "Read the approved_vets table filtered by owner residence + species.",
      input_schema: {
        type: "object",
        properties: {
          country: { type: "string" },
          city: { type: "string" },
          species: { type: "string" },
        },
        required: ["country", "species"],
      },
    },
    {
      name: "get_vet_availability",
      description: "Fetch the next available slots for a given vet within a date window.",
      input_schema: {
        type: "object",
        properties: {
          vet_id: { type: "string" },
          window_start: { type: "string", description: "YYYY-MM-DD" },
          window_end: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["vet_id", "window_start", "window_end"],
      },
    },
    {
      name: "propose_dates",
      description:
        "Terminal: emit candidate appointment dates into the active consensus round. Must include the procedures the slots cover and the cited rule windows.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          procedures: {
            type: "array",
            items: {
              type: "string",
              enum: ["microchip", "rabies_vaccine", "titer_draw", "health_certificate", "endorsement_visit"],
            },
            minItems: 1,
          },
          candidate_dates: {
            type: "array",
            items: { type: "string", description: "YYYY-MM-DD" },
            minItems: 1,
            maxItems: 5,
          },
          cited_rules: { type: "array", items: { type: "string" } },
        },
        required: ["case_id", "vet_id", "procedures", "candidate_dates", "cited_rules"],
      },
    },
    {
      name: "book_appointment",
      description:
        "Terminal: confirm a single appointment once the consensus round has locked a date. Idempotent on (case_id, vet_id, procedure, date).",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          procedure: {
            type: "string",
            enum: ["microchip", "rabies_vaccine", "titer_draw", "health_certificate", "endorsement_visit"],
          },
          date: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["case_id", "vet_id", "procedure", "date"],
      },
    },
    {
      name: "request_document",
      description: "Terminal: ask the owner via Comms for a document required before booking (e.g. existing vaccine record).",
      input_schema: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["rabies", "microchip", "vet_records", "titer_result"],
          },
        },
        required: ["kind"],
      },
    },
    {
      name: "no_vet_available",
      description: "Terminal: signal that no approved vet covers the owner's location or species. Routes to human.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: ["propose_dates", "book_appointment", "request_document", "no_vet_available"],
  budget: { max_turns: 5, max_input_tokens: 40_000 },
});
