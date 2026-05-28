// Vet Network — matches the owner to an approved vet and proposes procedure
// dates into the consensus timeline loop. Books only after the orchestrator
// locks a feasible plan.

import { type AgentDefinition, validateAgent } from "./types";

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network Team",
  description:
    "Matches the owner to an approved vet and books microchip, vaccine, titer, and pre-export exam appointments. Proposes dates into the consensus timeline loop.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "read_case_plan",
      description: "Read the case corridor, target_date, earliest_legal_departure, and pet species/breed.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "find_approved_vets",
      description: "List approved/accredited vets for a country, optionally narrowed by city and species.",
      input_schema: {
        type: "object",
        properties: {
          country: { type: "string" },
          species: { type: "string" },
          city: { type: "string" },
        },
        required: ["country", "species"],
      },
    },
    {
      name: "propose_appointments",
      description:
        "Terminal: submit candidate appointment dates into the timeline consensus round. Each procedure date must respect the rule waits (e.g. titer 30 days after vaccine).",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          proposals: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                procedure: {
                  type: "string",
                  enum: ["microchip", "primary_rabies", "rabies_titer", "booster", "health_check", "pre_export_exam"],
                },
                vet_id: { type: "string" },
                proposed_date: { type: "string", description: "YYYY-MM-DD" },
              },
              required: ["procedure", "vet_id", "proposed_date"],
            },
          },
        },
        required: ["case_id", "proposals"],
      },
    },
    {
      name: "book_appointment",
      description: "Terminal: lock a single appointment once the orchestrator has confirmed a feasible plan.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          procedure: {
            type: "string",
            enum: ["microchip", "primary_rabies", "rabies_titer", "booster", "health_check", "pre_export_exam"],
          },
          date: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["case_id", "vet_id", "procedure", "date"],
      },
    },
    {
      name: "ask_user_for_input",
      description: "Terminal: ask the owner via Comms for a missing fact (e.g. their city, or a preferred clinic).",
      input_schema: {
        type: "object",
        properties: {
          field: { type: "string" },
          question: { type: "string" },
        },
        required: ["field", "question"],
      },
    },
  ],
  terminal_tools: ["propose_appointments", "book_appointment", "ask_user_for_input"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
