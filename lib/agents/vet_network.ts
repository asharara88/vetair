// Vet Network — books partner-vet appointments for the medical events the
// corridor requires (microchip, primary rabies, titer draw, OV endorsement
// exam). Proposes slots; does not advise medically.

import { type AgentDefinition, validateAgent } from "./types";

const VET_APPOINTMENT_KINDS = [
  "microchip_implant",
  "primary_rabies",
  "booster_rabies",
  "titer_draw",
  "dhpp",
  "fvrcp",
  "ov_endorsement_exam",
] as const;

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to a partner vet and books the medical events the corridor requires. Capability-matched, slot-proposing, never auto-books without owner confirmation outside concierge tier.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "list_partner_vets",
      description:
        "Read partner vets filtered by country + city + required capabilities (e.g. titer_draw, ov_endorsement).",
      input_schema: {
        type: "object",
        properties: {
          country: { type: "string" },
          city: { type: "string" },
          capabilities: { type: "array", items: { type: "string" } },
        },
        required: ["country", "capabilities"],
      },
    },
    {
      name: "read_vet_calendar",
      description:
        "Read available slots from a partner vet for a specific appointment kind within a window.",
      input_schema: {
        type: "object",
        properties: {
          vet_id: { type: "string" },
          kind: { type: "string", enum: [...VET_APPOINTMENT_KINDS] },
          window_start: { type: "string" },
          window_end: { type: "string" },
        },
        required: ["vet_id", "kind", "window_start", "window_end"],
      },
    },
    {
      name: "propose_slots",
      description:
        "Persist a proposal of >= 2 slots for the owner to choose from. Returns proposal_id used by request_owner_choice.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          kind: { type: "string", enum: [...VET_APPOINTMENT_KINDS] },
          slots: {
            type: "array",
            minItems: 2,
            items: {
              type: "object",
              properties: {
                vet_id: { type: "string" },
                start: { type: "string" },
                end: { type: "string" },
              },
              required: ["vet_id", "start", "end"],
            },
          },
        },
        required: ["case_id", "kind", "slots"],
      },
    },
    {
      name: "book_appointment",
      description:
        "Terminal: confirm a slot. Use only when (a) owner has acknowledged the proposal, or (b) service_tier=concierge and the proposal was acknowledged in the last 24h.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          kind: { type: "string", enum: [...VET_APPOINTMENT_KINDS] },
          slot: {
            type: "object",
            properties: {
              start: { type: "string" },
              end: { type: "string" },
            },
            required: ["start", "end"],
          },
        },
        required: ["case_id", "vet_id", "kind", "slot"],
      },
    },
    {
      name: "request_owner_choice",
      description:
        "Terminal: hand the proposal to Comms so the owner picks a slot.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          proposal_id: { type: "string" },
          channel: { type: "string", enum: ["whatsapp", "email"] },
        },
        required: ["case_id", "proposal_id", "channel"],
      },
    },
    {
      name: "handoff_no_capacity",
      description:
        "Terminal: no partner vet covers the city + capability within the legal window. Surfaces the case for orchestrator widening or human review.",
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
  terminal_tools: [
    "book_appointment",
    "request_owner_choice",
    "handoff_no_capacity",
  ],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
