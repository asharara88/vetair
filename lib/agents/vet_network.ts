// Vet Network — matches the case to an approved partner clinic and books the
// procedures Compliance requires (microchip, vaccinations, titer, endorsement).

import { type AgentDefinition, validateAgent } from "./types";

const PROCEDURES = [
  "microchip_implant",
  "rabies_vaccine",
  "dhpp_vaccine",
  "fvrcp_vaccine",
  "titer_test",
  "health_check",
  "endorsement_exam",
] as const;

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the case to an approved partner clinic and books required procedures (microchip, vaccinations, titer, endorsement exam). Procedure ordering follows the compliance timeline.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "list_partner_vets",
      description:
        "List approved partner clinics in a country/city that hold the requested capabilities.",
      input_schema: {
        type: "object",
        properties: {
          country: { type: "string" },
          city: { type: "string" },
          capabilities: {
            type: "array",
            items: { type: "string", enum: [...PROCEDURES] },
          },
        },
        required: ["country", "capabilities"],
      },
    },
    {
      name: "check_availability",
      description:
        "Fetch open slots at a given clinic for a procedure inside a date range.",
      input_schema: {
        type: "object",
        properties: {
          vet_id: { type: "string" },
          procedure: { type: "string", enum: [...PROCEDURES] },
          date_from: { type: "string" },
          date_to: { type: "string" },
        },
        required: ["vet_id", "procedure", "date_from", "date_to"],
      },
    },
    {
      name: "book_appointment",
      description: "Book a single slot at a clinic for the case.",
      input_schema: {
        type: "object",
        properties: {
          vet_id: { type: "string" },
          case_id: { type: "string" },
          procedure: { type: "string", enum: [...PROCEDURES] },
          slot_id: { type: "string" },
        },
        required: ["vet_id", "case_id", "procedure", "slot_id"],
      },
    },
    {
      name: "emit_booking_plan",
      description:
        "Terminal: write the full booking plan back to the case. Every booking must cite a requirement_code.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          bookings: {
            type: "array",
            items: {
              type: "object",
              properties: {
                procedure: { type: "string", enum: [...PROCEDURES] },
                vet_id: { type: "string" },
                vet_name: { type: "string" },
                scheduled_for: { type: "string" },
                requirement_code: { type: "string" },
              },
              required: ["procedure", "vet_id", "scheduled_for", "requirement_code"],
            },
            minItems: 1,
          },
        },
        required: ["case_id", "bookings"],
      },
    },
    {
      name: "escalate_no_capacity",
      description:
        "Terminal: no partner vet has capacity in the legally-feasible window. Orchestrator decides whether to push the flight or escalate.",
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
  terminal_tools: ["emit_booking_plan", "escalate_no_capacity"],
  budget: { max_turns: 8, max_input_tokens: 40_000 },
});
