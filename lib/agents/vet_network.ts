// Vet Network — matches an owner to an approved clinic and proposes booking
// slots for the procedures the case needs (microchip, primary vaccine, titer,
// boosters, pre-travel exam). Output is a proposed slot the orchestrator then
// pushes into the consensus timeline. The agent does not commit a booking by
// itself — committing is the orchestrator's job after consensus.

import { type AgentDefinition, validateAgent } from "./types";

const PROCEDURE_KIND = [
  "microchip",
  "primary_rabies",
  "rabies_booster",
  "titer_blood_draw",
  "pre_travel_exam",
  "health_certificate_issuance",
] as const;

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved clinic and proposes appointment slots for the procedures the case needs. Does not commit; the orchestrator merges proposals into the consensus timeline.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "read_case",
      description: "Read the case row by id (state, corridor, target_date, earliest_legal_departure).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_owner",
      description: "Read the owner row (residence_country, residence_city, locale) so we can find local partner clinics.",
      input_schema: {
        type: "object",
        properties: { owner_id: { type: "string" } },
        required: ["owner_id"],
      },
    },
    {
      name: "read_pet_facts",
      description: "Read the pet row (microchip status, vaccination dates, weight) so we know which procedures still apply.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "list_partner_clinics",
      description: "List approved partner clinics in a city/country, optionally filtered by required_capability (e.g. titer, microchip, OV endorsement).",
      input_schema: {
        type: "object",
        properties: {
          country: { type: "string" },
          city: { type: "string" },
          required_capability: { type: "string" },
        },
        required: ["country"],
      },
    },
    {
      name: "read_clinic_calendar",
      description: "Read free slots for a clinic across a date window. Returns ISO timestamps.",
      input_schema: {
        type: "object",
        properties: {
          clinic_id: { type: "string" },
          procedure: { type: "string", enum: [...PROCEDURE_KIND] },
          from_date: { type: "string", description: "ISO date YYYY-MM-DD" },
          to_date: { type: "string", description: "ISO date YYYY-MM-DD" },
        },
        required: ["clinic_id", "procedure", "from_date", "to_date"],
      },
    },
    {
      name: "propose_booking",
      description:
        "Terminal: emit a proposed appointment slot for the consensus timeline. May propose multiple alternatives in a single call. Window dates MUST respect earliest_legal_departure and the case's target window.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          procedure: { type: "string", enum: [...PROCEDURE_KIND] },
          proposals: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                clinic_id: { type: "string" },
                clinic_name: { type: "string" },
                slot_start: { type: "string", description: "ISO 8601 timestamp" },
                slot_end: { type: "string", description: "ISO 8601 timestamp" },
                rationale: { type: "string", description: "Why this slot was chosen (e.g. 'falls inside endorsement window')." },
              },
              required: ["clinic_id", "slot_start", "slot_end", "rationale"],
            },
          },
        },
        required: ["case_id", "procedure", "proposals"],
      },
    },
    {
      name: "fail_match",
      description: "Terminal: abort. Use when no partner clinic in the corridor offers the required capability, or no slot exists within the legal window.",
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
  terminal_tools: ["propose_booking", "fail_match"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});

export const VET_NETWORK_PROCEDURE_KIND = PROCEDURE_KIND;
