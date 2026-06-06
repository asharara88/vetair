// Endorsement — owns the 10-day pre-flight endorsement window: schedules the
// OV health certificate, submits to the export authority (MOCCAE / APHA /
// equivalent), and tracks the courier to the destination port-of-entry.

import { type AgentDefinition, validateAgent } from "./types";

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement Team",
  description:
    "Locks the 10-day endorsement window, submits to MOCCAE / APHA / equivalent, and tracks the courier to the destination port-of-entry.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_routing",
      description:
        "Read the locked airline routing for this case (flight date, origin, destination). Needed to anchor the 10-day endorsement window.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_vet_plan",
      description:
        "Read the vet appointments locked by Vet Network for this case. The health-certificate appointment must fall inside the endorsement window.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "compute_window",
      description:
        "Deterministic: given the flight date, return the (earliest, latest) legal endorsement issue dates per the destination's rule set.",
      input_schema: {
        type: "object",
        properties: {
          flight_date: { type: "string", description: "ISO YYYY-MM-DD" },
          destination_country: { type: "string" },
        },
        required: ["flight_date", "destination_country"],
      },
    },
    {
      name: "submit_to_authority",
      description:
        "Submit the OV health certificate to the export authority (MOCCAE for UAE export, APHA for UK export, etc.). Returns a tracking reference.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: ["MOCCAE", "APHA", "USDA_APHIS", "AVS_SG", "MAFRA_KR", "OTHER"] },
          health_certificate_doc_id: { type: "string" },
          flight_date: { type: "string" },
        },
        required: ["case_id", "authority", "health_certificate_doc_id", "flight_date"],
      },
    },
    {
      name: "track_courier",
      description:
        "Poll the courier (DHL / FedEx / TNT) for the endorsed certificate's transit status to the destination port-of-entry.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          tracking_number: { type: "string" },
        },
        required: ["case_id", "tracking_number"],
      },
    },
    {
      name: "emit_status",
      description:
        "Terminal: write the endorsement status (window locked, submitted, in transit, delivered). cited_rules must reference the endorsement-window requirement_code from the corridor.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          status: {
            type: "string",
            enum: ["window_locked", "appointment_booked", "submitted", "in_transit", "delivered", "rejected_by_authority"],
          },
          tracking_reference: { type: "string" },
          window: {
            type: "object",
            properties: {
              earliest: { type: "string" },
              latest: { type: "string" },
            },
          },
          cited_rules: { type: "array", items: { type: "string" } },
        },
        required: ["case_id", "status", "cited_rules"],
      },
    },
    {
      name: "fail_endorsement",
      description:
        "Terminal: abort. Use when the flight date leaves no feasible endorsement window or the authority rejects the submission.",
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
  terminal_tools: ["emit_status", "fail_endorsement"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
