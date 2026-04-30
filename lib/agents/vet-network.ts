// Vet Network — matches the owner to an approved vet and proposes appointments
// (microchip / vaccine / titer / endorsement). Proposals enter the consensus
// timeline loop the Orchestrator runs; this agent does not commit bookings.

import { type AgentDefinition, validateAgent } from "./types";
import { READ_CASE_TOOL, READ_PET_FACTS_TOOL } from "./tools";

const APPOINTMENT_KINDS = [
  "microchip",
  "rabies_vaccine",
  "rabies_titer",
  "health_check",
  "endorsement",
] as const;

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved vet and proposes microchip / vaccine / titer / endorsement appointments for the consensus timeline.",
  prompt_path: "lib/prompts/vet-network.md",
  tools: [
    READ_CASE_TOOL,
    READ_PET_FACTS_TOOL,
    {
      name: "list_approved_vets",
      description:
        "Read approved_vets filtered by country and city. Returns clinic name, services offered, distance, and earliest available slot.",
      input_schema: {
        type: "object",
        properties: {
          country: { type: "string" },
          city: { type: "string" },
          service: {
            type: "string",
            enum: [...APPOINTMENT_KINDS],
            description: "Optional — filter to clinics that offer this service.",
          },
        },
        required: ["country"],
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
      name: "propose_appointment",
      description:
        "Terminal: propose a single appointment for the consensus timeline. Orchestrator votes; do not assume the date will be accepted.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          kind: { type: "string", enum: [...APPOINTMENT_KINDS] },
          proposed_date: {
            type: "string",
            description: "ISO date YYYY-MM-DD.",
          },
          rationale: { type: "string" },
        },
        required: ["case_id", "vet_id", "kind", "proposed_date", "rationale"],
      },
    },
    {
      name: "fail_no_vet",
      description:
        "Terminal: abort. Use when no approved vet in the owner's country offers the required service inside the target window.",
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
  terminal_tools: ["propose_appointment", "fail_no_vet"],
  budget: { max_turns: 4, max_input_tokens: 30_000 },
});
