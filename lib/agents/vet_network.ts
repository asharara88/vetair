// Vet Network — matches the owner to an approved partner vet and proposes
// appointment dates for microchip, vaccine, titer, and endorsement steps.
// Participates in the consensus timeline loop (AGENT.md §2.2) by emitting
// a date proposal that the orchestrator reconciles with airline_crate and
// endorsement before any booking is confirmed.

import { type AgentDefinition, validateAgent, READ_CASE_TOOL, DATE_WINDOW_PROPERTIES } from "./types";

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved partner vet. Proposes appointment dates for microchip, vaccine, titer, and endorsement steps.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    READ_CASE_TOOL,
    {
      name: "list_partner_vets",
      description: "Read partner_vets filtered by country and city. Returns approved-for-endorsement vets with capacity.",
      input_schema: {
        type: "object",
        properties: {
          country: { type: "string", description: "ISO-3166 alpha-2." },
          city: { type: "string" },
          service: {
            type: "string",
            enum: ["microchip", "rabies_vaccine", "titer", "endorsement", "health_check"],
          },
        },
        required: ["country", "service"],
      },
    },
    {
      name: "read_vet_availability",
      description: "Read a vet's open appointment windows for a service kind over a date range.",
      input_schema: {
        type: "object",
        properties: {
          vet_id: { type: "string" },
          service: {
            type: "string",
            enum: ["microchip", "rabies_vaccine", "titer", "endorsement", "health_check"],
          },
          from_date: { type: "string" },
          to_date: { type: "string" },
        },
        required: ["vet_id", "service", "from_date", "to_date"],
      },
    },
    {
      name: "propose_appointment",
      description:
        "Terminal: propose a vet appointment for the consensus timeline round. Does NOT book. The orchestrator reconciles this with airline_crate and endorsement proposals before any booking is confirmed.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          service: {
            type: "string",
            enum: ["microchip", "rabies_vaccine", "titer", "endorsement", "health_check"],
          },
          ...DATE_WINDOW_PROPERTIES,
          rationale: { type: "string", description: "Why this vet + window. Cite distance, capacity, endorsement approval." },
        },
        required: ["case_id", "vet_id", "service", "earliest_date", "latest_date", "preferred_date", "rationale"],
      },
    },
    {
      name: "book_appointment",
      description:
        "Terminal: confirm a vet appointment. Use ONLY after the orchestrator returns a consensus-approved date that matches a proposal.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          service: {
            type: "string",
            enum: ["microchip", "rabies_vaccine", "titer", "endorsement", "health_check"],
          },
          appointment_date: { type: "string", description: "ISO YYYY-MM-DD." },
        },
        required: ["case_id", "vet_id", "service", "appointment_date"],
      },
    },
    {
      name: "request_vet_coverage",
      description:
        "Terminal: no partner vet covers the owner's location for the requested service. Hand off to a human to onboard one.",
      input_schema: {
        type: "object",
        properties: {
          country: { type: "string" },
          city: { type: "string" },
          service: { type: "string" },
          reason: { type: "string" },
        },
        required: ["country", "service", "reason"],
      },
    },
  ],
  terminal_tools: ["propose_appointment", "book_appointment", "request_vet_coverage"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
