// Endorsement — the 10-day-window scheduler and packet submitter.
// Owns the timing math for the endorsement appointment (7–10 days pre-flight
// in most corridors), then submits the packet to MOCCAE / APHA / equivalent
// and tracks the courier to the destination border post.

import { type AgentDefinition, validateAgent } from "./types";

const AUTHORITIES = ["MOCCAE", "APHA", "USDA", "DEFRA", "CFIA", "AQIS", "other"] as const;

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement Desk",
  description:
    "Endorsement-window scheduling (7–10 days pre-flight). Submits MOCCAE/APHA packets and tracks the courier to the destination border post.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_case",
      description:
        "Read the case row. flight_date, destination_country, and earliest_legal_departure drive the endorsement-window math.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_health_cert",
      description:
        "Read the uploaded health certificate document (the OV's pre-endorsement artifact). Returns extracted_fields + issue_date.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "compute_endorsement_window",
      description:
        "Compute the legal endorsement window for the destination country: returns { window_open, window_close } as ISO dates relative to flight_date.",
      input_schema: {
        type: "object",
        properties: {
          flight_date: { type: "string", description: "ISO YYYY-MM-DD" },
          destination_country: { type: "string", description: "ISO-3166 alpha-2" },
        },
        required: ["flight_date", "destination_country"],
      },
    },
    {
      name: "schedule_endorsement",
      description:
        "Reserve an OV/government endorsement appointment within the legal window. Returns appointment_id; does NOT confirm the packet submission.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          appointment_date: { type: "string", description: "ISO YYYY-MM-DDTHH:MM" },
          vet_id: { type: "string", description: "OV/clinic id from partner_vets" },
        },
        required: ["case_id", "appointment_date", "vet_id"],
      },
    },
    {
      name: "submit_packet",
      description:
        "Terminal: submit the endorsement packet to the authority. Returns submission_id and a courier tracking placeholder; the authority's response lands on `endorsement_submissions` via webhook.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: [...AUTHORITIES] },
          appointment_id: { type: "string" },
          packet_document_ids: {
            type: "array",
            items: { type: "string" },
            description: "Document ids that make up the packet (health cert, rabies cert, microchip record, etc.).",
            minItems: 1,
          },
        },
        required: ["case_id", "authority", "appointment_id", "packet_document_ids"],
      },
    },
    {
      name: "track_courier",
      description:
        "Terminal: register the courier tracking number for the endorsed packet so the orchestrator can poll status until delivery at the destination border post.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          submission_id: { type: "string" },
          courier: { type: "string", description: "DHL, FedEx, Aramex, etc." },
          tracking_number: { type: "string" },
        },
        required: ["case_id", "submission_id", "courier", "tracking_number"],
      },
    },
    {
      name: "escalate_window_breach",
      description:
        "Terminal: the flight_date forces the endorsement window outside what the authority will accept. Routes to human concierge to renegotiate the flight date with the owner.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_feasible_flight: { type: "string", description: "ISO YYYY-MM-DD" },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: ["submit_packet", "track_courier", "escalate_window_breach"],
  budget: { max_turns: 5, max_input_tokens: 40_000 },
});

export const ENDORSEMENT_AUTHORITIES = AUTHORITIES;
