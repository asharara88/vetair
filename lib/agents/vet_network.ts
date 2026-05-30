// Vet Network — books the owner into the right vet for the next required
// procedure (microchip, rabies, titer, or pre-export endorsement). The agent
// proposes slots but never confirms — confirmation comes from Comms once the
// owner picks one.

import { type AgentDefinition, validateAgent } from "./types";
import { ACKNOWLEDGE_AND_WAIT_TOOL } from "./shared-tools";

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved vet for the next required procedure and proposes booking slots.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "read_case_facts",
      description: "Read case + pet + owner location so the search is geographically sane.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_open_requirements",
      description: "Read the case's open requirement_evaluations to know which procedures still need a vet appointment.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "search_approved_vets",
      description:
        "Search the approved_vets table. Use service filters that match the procedure (microchip / rabies / titer / endorsement). Returns at most 10 vets, ranked by proximity then capability score.",
      input_schema: {
        type: "object",
        properties: {
          country: { type: "string", description: "ISO-3166 alpha-2." },
          city: { type: "string" },
          services: {
            type: "array",
            items: {
              type: "string",
              enum: ["microchip", "rabies", "titer", "endorsement", "health_certificate"],
            },
            minItems: 1,
          },
        },
        required: ["country", "services"],
      },
    },
    {
      name: "read_vet_availability",
      description: "Read a vet's open slots inside the candidate window (typically the endorsement window).",
      input_schema: {
        type: "object",
        properties: {
          vet_id: { type: "string" },
          window_start: { type: "string", description: "ISO date." },
          window_end: { type: "string", description: "ISO date." },
        },
        required: ["vet_id", "window_start", "window_end"],
      },
    },
    {
      name: "propose_appointment",
      description:
        "Terminal: propose a concrete appointment for the owner to confirm. Writes to vet_appointments with status='proposed'. Comms is responsible for delivering the slot to the owner.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          service: {
            type: "string",
            enum: ["microchip", "rabies", "titer", "endorsement", "health_certificate"],
          },
          slot_start: { type: "string", description: "ISO datetime in vet's local timezone." },
          slot_end: { type: "string", description: "ISO datetime in vet's local timezone." },
          rationale: {
            type: "string",
            description: "Why this slot was chosen (e.g. fits 10-day endorsement window).",
          },
        },
        required: ["case_id", "vet_id", "service", "slot_start", "rationale"],
      },
    },
    {
      name: "no_match_available",
      description:
        "Terminal: no approved vet matched within the required window. Hands off to the orchestrator so it can escalate to human or widen the search.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          searched_country: { type: "string" },
          searched_services: { type: "array", items: { type: "string" } },
          reason: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: ["propose_appointment", "no_match_available", "acknowledge_and_wait"],
  budget: { max_turns: 5, max_input_tokens: 30_000 },
});
