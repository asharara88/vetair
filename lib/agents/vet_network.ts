// Vet Network — matches the owner to an approved practice and proposes
// procedure appointments (microchip, vaccine, titer, endorsement exam).
// One of three voices that converge on a feasible timeline; never books
// directly — proposes dates back to the orchestrator's consensus round.

import { type AgentDefinition, validateAgent } from "./types";
import { ACKNOWLEDGE_AND_WAIT_TOOL, CASE_ID_INPUT } from "./shared-tools";

const PROCEDURE_KINDS = [
  "microchip",
  "rabies_vaccine",
  "rabies_titer",
  "dhpp",
  "fvrcp",
  "health_exam",
  "endorsement_exam",
] as const;

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved practice and proposes procedure appointments. Voice 1 of 3 in the timeline consensus loop.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "read_pet_facts",
      description: "Read the pet row (species, weight, microchip, vaccine history) for a case.",
      input_schema: CASE_ID_INPUT,
    },
    {
      name: "read_owner_location",
      description: "Read the owner's residence city + country to scope the vet search.",
      input_schema: CASE_ID_INPUT,
    },
    {
      name: "find_approved_vets",
      description:
        "Search the approved-vet directory near the owner. Returns vet rows with rating, MOCCAE/APHA endorsement authority, and species coverage.",
      input_schema: {
        type: "object",
        properties: {
          country: { type: "string" },
          city: { type: "string" },
          radius_km: { type: "number", minimum: 1, maximum: 200 },
          species: { type: "string" },
        },
        required: ["country", "species"],
      },
    },
    {
      name: "read_vet_availability",
      description: "Read available appointment slots for a vet in a date window.",
      input_schema: {
        type: "object",
        properties: {
          vet_id: { type: "string" },
          window_start: { type: "string", description: "ISO date (YYYY-MM-DD)" },
          window_end: { type: "string", description: "ISO date (YYYY-MM-DD)" },
        },
        required: ["vet_id", "window_start", "window_end"],
      },
    },
    {
      name: "propose_procedures",
      description:
        "Terminal: emit a proposed sequence of vet procedures with dates. The orchestrator runs the consensus round; do not assume the dates are final.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          procedures: {
            type: "array",
            items: {
              type: "object",
              properties: {
                kind: { type: "string", enum: [...PROCEDURE_KINDS] },
                proposed_date: { type: "string", description: "ISO date (YYYY-MM-DD)" },
                rationale: { type: "string" },
                cited_rules: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "Requirement codes this procedure satisfies. Empty array if the procedure is informational.",
                },
              },
              required: ["kind", "proposed_date", "rationale"],
            },
            minItems: 1,
          },
        },
        required: ["case_id", "vet_id", "procedures"],
      },
    },
    {
      name: "flag_no_match",
      description:
        "Terminal: no approved vet within reach can satisfy the schedule. Orchestrator escalates or expands radius.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: ["propose_procedures", "flag_no_match", "acknowledge_and_wait"],
  budget: { max_turns: 6, max_input_tokens: 30_000 },
});
