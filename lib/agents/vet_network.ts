// Vet Network — matches the owner to an approved vet and books the in-corridor
// procedures (microchip, rabies vaccine, titer draw, endorsement appointment).
// Outputs proposed dates into the consensus timeline loop; final commit happens
// after Airline & Crate and Endorsement converge on a feasible window.

import { type AgentDefinition, validateAgent } from "./types";
import {
  ACKNOWLEDGE_AND_WAIT_TOOL,
  READ_CASE_TOOL,
  READ_PET_FACTS_TOOL,
} from "./tools-shared";

const PROCEDURE_KINDS = [
  "microchip",
  "rabies_primary",
  "rabies_booster",
  "titer_draw",
  "health_check",
  "endorsement_visit",
] as const;

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved in-corridor vet and proposes appointment dates for microchip, rabies, titer, and endorsement visits.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    READ_CASE_TOOL,
    READ_PET_FACTS_TOOL,
    {
      name: "list_approved_vets",
      description: "Read the approved vet list for the case's origin country, optionally filtered by city.",
      input_schema: {
        type: "object",
        properties: {
          origin_country: { type: "string" },
          city: { type: "string" },
        },
        required: ["origin_country"],
      },
    },
    {
      name: "read_vet_availability",
      description: "Read open slots for a vet across a date range. Returns ISO timestamps.",
      input_schema: {
        type: "object",
        properties: {
          vet_id: { type: "string" },
          from_date: { type: "string" },
          to_date: { type: "string" },
        },
        required: ["vet_id", "from_date", "to_date"],
      },
    },
    {
      name: "propose_appointment",
      description:
        "Write a proposed appointment into the consensus timeline (not yet booked). Repeat for each procedure the case needs.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          procedure: { type: "string", enum: [...PROCEDURE_KINDS] },
          proposed_at: { type: "string", description: "ISO 8601 timestamp." },
        },
        required: ["case_id", "vet_id", "procedure", "proposed_at"],
      },
    },
    {
      name: "emit_vet_plan",
      description:
        "Terminal: commit the vet-side plan. Lists every procedure with its proposed_at + vet_id. Orchestrator opens a consensus round against this plan.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          procedures: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                procedure: { type: "string", enum: [...PROCEDURE_KINDS] },
                proposed_at: { type: "string" },
              },
              required: ["procedure", "proposed_at"],
            },
          },
        },
        required: ["case_id", "vet_id", "procedures"],
      },
    },
    {
      name: "request_owner_choice",
      description:
        "Terminal: surface multiple vet candidates to the owner via Comms. Use only when two or more vets satisfy the constraints equally.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          options: {
            type: "array",
            minItems: 2,
            items: {
              type: "object",
              properties: {
                vet_id: { type: "string" },
                label: { type: "string" },
              },
              required: ["vet_id", "label"],
            },
          },
        },
        required: ["case_id", "options"],
      },
    },
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: ["emit_vet_plan", "request_owner_choice", "acknowledge_and_wait"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
