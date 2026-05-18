// Vet Network — matches the owner to an approved vet and books the
// microchip / vaccine / titer / endorsement appointments needed for the
// corridor. Proposes dates into the consensus timeline loop; the orchestrator
// reconciles against airline_crate + endorsement before booking sticks.

import { type AgentDefinition, validateAgent } from "./types";

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved vet and books the microchip / vaccine / titer / endorsement appointments the corridor demands. Proposes dates into the consensus timeline loop.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "find_approved_vets",
      description:
        "List approved partner vets near the owner. Filter by country, optional city, and species coverage.",
      input_schema: {
        type: "object",
        properties: {
          country: { type: "string" },
          city: { type: "string" },
          species: { type: "string" },
          max_distance_km: { type: "integer", minimum: 1, maximum: 200 },
        },
        required: ["country"],
      },
    },
    {
      name: "read_appointment_slots",
      description:
        "Read available slots for a vet across a date window. Slots are returned as ISO datetimes with service codes the vet supports.",
      input_schema: {
        type: "object",
        properties: {
          vet_id: { type: "string" },
          from: { type: "string", description: "ISO date inclusive" },
          to: { type: "string", description: "ISO date inclusive" },
          service: {
            type: "string",
            enum: ["microchip", "rabies", "titer", "endorsement", "health_cert", "consult"],
          },
        },
        required: ["vet_id", "from", "to"],
      },
    },
    {
      name: "read_required_procedures",
      description:
        "Read the ordered list of vet procedures the corridor requires for this case (derived from compliance assessment + country rules).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "propose_timeline",
      description:
        "Terminal: propose a chronologically valid sequence of appointments into the consensus round. Orchestrator reconciles against airline_crate + endorsement before any booking is confirmed.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          appointments: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                service: {
                  type: "string",
                  enum: ["microchip", "rabies", "titer", "endorsement", "health_cert", "consult"],
                },
                vet_id: { type: "string" },
                scheduled_at: { type: "string", description: "ISO datetime" },
                cited_rules: {
                  type: "array",
                  items: { type: "string" },
                  description: "requirement_codes this appointment satisfies",
                },
              },
              required: ["service", "vet_id", "scheduled_at", "cited_rules"],
            },
          },
        },
        required: ["case_id", "appointments"],
      },
    },
    {
      name: "book_appointment",
      description:
        "Terminal: lock a single appointment once the consensus round has resolved. Use only after orchestrator hands back a `confirm_appointments` payload.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          scheduled_at: { type: "string" },
          service: {
            type: "string",
            enum: ["microchip", "rabies", "titer", "endorsement", "health_cert", "consult"],
          },
        },
        required: ["case_id", "vet_id", "scheduled_at", "service"],
      },
    },
    {
      name: "fail_no_match",
      description:
        "Terminal: abort. Use when no approved vet covers the owner's location or no slot fits the legal date window.",
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
  terminal_tools: ["propose_timeline", "book_appointment", "fail_no_match"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
