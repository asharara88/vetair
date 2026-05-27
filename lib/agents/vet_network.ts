// Vet Network — matches the owner to an approved vet and books the
// procedures the case needs (microchip, vaccine, titer, endorsement). The
// orchestrator dispatches this once Compliance returns an approved or
// pending verdict that names a missing procedure.

import { type AgentDefinition, validateAgent } from "./types";

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved vet near their location and books the required procedures — microchip, vaccine, titer, or endorsement.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "read_case_facts",
      description: "Read owner + pet + case (residence, target_date, missing requirements).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "search_approved_vets",
      description:
        "Search the approved_vets table near the owner's residence that offer the requested procedure type.",
      input_schema: {
        type: "object",
        properties: {
          city: { type: "string" },
          country: { type: "string" },
          procedure: {
            type: "string",
            enum: ["microchip", "vaccine", "titer", "endorsement", "health_check"],
          },
          radius_km: { type: "integer", minimum: 1, maximum: 200 },
        },
        required: ["country", "procedure"],
      },
    },
    {
      name: "propose_appointment",
      description:
        "Propose a candidate appointment slot to the owner via Comms. Non-terminal — waits for owner confirmation.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          procedure: {
            type: "string",
            enum: ["microchip", "vaccine", "titer", "endorsement", "health_check"],
          },
          earliest_iso: { type: "string", description: "ISO 8601 earliest acceptable slot." },
          latest_iso: { type: "string", description: "ISO 8601 latest acceptable slot." },
        },
        required: ["case_id", "vet_id", "procedure", "earliest_iso", "latest_iso"],
      },
    },
    {
      name: "book_appointment",
      description:
        "Terminal: confirm a booked appointment. Writes to vet_appointments and links to the case.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          procedure: {
            type: "string",
            enum: ["microchip", "vaccine", "titer", "endorsement", "health_check"],
          },
          appointment_at: { type: "string", description: "ISO 8601 timestamp." },
          notes: { type: "string" },
        },
        required: ["case_id", "vet_id", "procedure", "appointment_at"],
      },
    },
    {
      name: "ask_user_for_input",
      description: "Terminal: ask the owner via Comms for a missing fact (e.g. preferred city).",
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
      name: "acknowledge_and_wait",
      description:
        "Terminal: yield without booking — e.g. waiting on owner confirmation of a proposed slot.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: ["book_appointment", "ask_user_for_input", "acknowledge_and_wait"],
  budget: { max_turns: 5, max_input_tokens: 30_000 },
});
