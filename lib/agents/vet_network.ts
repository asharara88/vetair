// Vet Network — matches the owner to an approved vet on the corridor and books
// the procedural milestones (microchip, vaccine, titer, OV endorsement appt).
// Proposes a date, then participates in the timeline-feasibility consensus round.

import { type AgentDefinition, validateAgent } from "./types";
import { ACKNOWLEDGE_AND_WAIT_TOOL } from "./shared-tools";

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved vet on the active corridor and books microchip / vaccine / titer / endorsement appointments. Proposes dates that the timeline consensus round reconciles.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "list_approved_vets",
      description: "Read approved_vets filtered by corridor + species + service (microchip/rabies/titer/endorsement).",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string" },
          destination: { type: "string" },
          species: { type: "string" },
          service: {
            type: "string",
            enum: ["microchip", "rabies", "titer", "health_certificate", "endorsement"],
          },
        },
        required: ["origin", "destination", "species", "service"],
      },
    },
    {
      name: "read_pet_facts",
      description: "Read the case's pet row (DOB, weight, microchip, prior vaccinations).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_assessment",
      description: "Read the latest compliance assessment so the proposed schedule respects every cited requirement.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "propose_appointment",
      description: "Propose (do not commit) a vet appointment slot. Adds it to the consensus round payload.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          service: {
            type: "string",
            enum: ["microchip", "rabies", "titer", "health_certificate", "endorsement"],
          },
          date: { type: "string", description: "YYYY-MM-DD" },
          notes: { type: "string" },
        },
        required: ["case_id", "vet_id", "service", "date"],
      },
    },
    {
      name: "book_appointment",
      description: "Terminal: write a confirmed appointment row once the timeline round resolves. The Orchestrator gates this — only call when the consensus has approved the slate.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          service: {
            type: "string",
            enum: ["microchip", "rabies", "titer", "health_certificate", "endorsement"],
          },
          date: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["case_id", "vet_id", "service", "date"],
      },
    },
    {
      name: "no_match",
      description: "Terminal: no approved vet covers the requested service on this corridor. Hands the case back to the Orchestrator for escalation.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          service: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "service", "reason"],
      },
    },
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: ["book_appointment", "no_match", "acknowledge_and_wait"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
