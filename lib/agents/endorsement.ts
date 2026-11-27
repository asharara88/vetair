// Endorsement — sequences the 7–10 day pre-flight window. Submits the health
// certificate to the destination authority (MOCCAE / APHA / DEFRA etc.),
// books the courier, polls status, and surfaces the signed artifact.

import { type AgentDefinition, validateAgent } from "./types";

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Sequences the 7–10 day pre-flight endorsement window: authority submission, courier handoff, status polling, signed artifact capture.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_endorsement_authority",
      description:
        "Read the endorsement_authorities row for the destination country. Returns authority (MOCCAE/APHA/DEFRA/...), channel (portal/courier/in_person), submission_window_days, turnaround_hours, portal_url, forms_required[].",
      input_schema: {
        type: "object",
        properties: { destination_country: { type: "string" } },
        required: ["destination_country"],
      },
    },
    {
      name: "read_health_certificate",
      description:
        "Read the signed health certificate document row linked to this case (the pre-flight exam output). Returns null if the vet has not uploaded it yet.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "compute_window",
      description:
        "Deterministic: given the booked departure_date and the authority's submission_window_days, return { earliest_submission_date, latest_submission_date, latest_courier_pickup_date }.",
      input_schema: {
        type: "object",
        properties: {
          departure_date: { type: "string", description: "ISO-8601 date." },
          destination_country: { type: "string" },
        },
        required: ["departure_date", "destination_country"],
      },
    },
    {
      name: "submit_to_authority",
      description:
        "Terminal: file the endorsement with the authority via its canonical channel. Writes an endorsement_submissions row and returns { submission_id, tracking_ref }. The health certificate must be present and the submission_date must sit inside compute_window.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string" },
          submission_channel: {
            type: "string",
            enum: ["portal", "courier", "in_person"],
          },
          submission_date: { type: "string" },
          health_certificate_document_id: { type: "string" },
          rationale: { type: "string" },
        },
        required: [
          "case_id",
          "authority",
          "submission_channel",
          "submission_date",
          "health_certificate_document_id",
          "rationale",
        ],
      },
    },
    {
      name: "schedule_courier",
      description:
        "Non-terminal: book a physical courier pickup for a hard-copy wet-signed certificate. Required before `submit_to_authority` when the authority's channel is `courier`. Returns a pickup window; continue the loop to call `submit_to_authority` after.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          pickup_date: { type: "string" },
          pickup_address: { type: "string" },
          destination: { type: "string", description: "Authority office address." },
        },
        required: ["case_id", "pickup_date", "pickup_address", "destination"],
      },
    },
    {
      name: "wait_for_health_certificate",
      description:
        "Terminal: cannot proceed — the vet has not yet uploaded the signed health certificate. Yields to the orchestrator; it will re-dispatch after vet_network completes.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
    {
      name: "escalate_window_missed",
      description:
        "Terminal: the submission window has already closed (departure too close, or vet exam too late). Escalates to the orchestrator so the booking can be rescheduled.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          window: {
            type: "object",
            properties: {
              earliest: { type: "string" },
              latest: { type: "string" },
            },
            required: ["earliest", "latest"],
          },
          reason: { type: "string" },
        },
        required: ["case_id", "window", "reason"],
      },
    },
  ],
  terminal_tools: [
    "submit_to_authority",
    "wait_for_health_certificate",
    "escalate_window_missed",
  ],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
