// Vet Network — matches the owner to an approved clinic and books the
// microchip / vaccine / titer / endorsement procedure sequence.

import { type AgentDefinition, validateAgent } from "./types";

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved clinic and books microchip / vaccine / titer / endorsement appointments in the order the country rules require.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "read_approved_vets",
      description:
        "List approved clinics in a city that offer the requested services (e.g. ['microchip','endorsement']).",
      input_schema: {
        type: "object",
        properties: {
          city: { type: "string" },
          services: {
            type: "array",
            items: {
              type: "string",
              enum: ["microchip", "rabies_vaccine", "rabies_titer", "health_certificate", "endorsement"],
            },
          },
        },
        required: ["city", "services"],
      },
    },
    {
      name: "read_vet_availability",
      description: "Read open slots for a vet inside a window.",
      input_schema: {
        type: "object",
        properties: {
          vet_id: { type: "string" },
          window_start: { type: "string", description: "ISO date YYYY-MM-DD" },
          window_end: { type: "string", description: "ISO date YYYY-MM-DD" },
        },
        required: ["vet_id", "window_start", "window_end"],
      },
    },
    {
      name: "propose_appointment",
      description:
        "Soft-hold a slot. The owner sees it via Comms. Reversible until book_appointment is called.",
      input_schema: {
        type: "object",
        properties: {
          vet_id: { type: "string" },
          procedure: {
            type: "string",
            enum: ["microchip", "rabies_vaccine", "rabies_titer", "health_certificate", "endorsement"],
          },
          slot_start: { type: "string", description: "ISO timestamp" },
        },
        required: ["vet_id", "procedure", "slot_start"],
      },
    },
    {
      name: "book_appointment",
      description: "Confirm a previously proposed slot. Irreversible.",
      input_schema: {
        type: "object",
        properties: { proposal_id: { type: "string" } },
        required: ["proposal_id"],
      },
    },
    {
      name: "emit_vet_plan",
      description:
        "Terminal: write the full sequenced appointment plan for the case. Every entry must cite the requirement_code(s) it satisfies.",
      input_schema: {
        type: "object",
        properties: {
          plan: {
            type: "array",
            items: {
              type: "object",
              properties: {
                procedure: {
                  type: "string",
                  enum: ["microchip", "rabies_vaccine", "rabies_titer", "health_certificate", "endorsement"],
                },
                vet_id: { type: "string" },
                scheduled_for: { type: "string", description: "ISO timestamp" },
                requirement_codes: { type: "array", items: { type: "string" } },
              },
              required: ["procedure", "vet_id", "scheduled_for", "requirement_codes"],
            },
            minItems: 1,
          },
          notes: { type: "string", description: "Free-text caveats (e.g. plan slips past target window)." },
        },
        required: ["plan"],
      },
    },
    {
      name: "request_owner_confirmation",
      description:
        "Terminal: hand the plan to Comms for owner confirmation before any irreversible booking.",
      input_schema: {
        type: "object",
        properties: {
          plan_id: { type: "string" },
          message: { type: "string" },
        },
        required: ["plan_id"],
      },
    },
    {
      name: "escalate_no_capacity",
      description:
        "Terminal: abort. Use when no approved clinic in the owner's city can satisfy a required service.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: ["emit_vet_plan", "request_owner_confirmation", "escalate_no_capacity"],
  budget: { max_turns: 8, max_input_tokens: 40_000 },
});
