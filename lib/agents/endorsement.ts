// Endorsement — 10-day pre-flight window, MOCCAE / APHA submission, courier
// tracking. Owns the regulator-facing leg of the case once Compliance approves.

import { type AgentDefinition, validateAgent } from "./types";
import {
  ACKNOWLEDGE_AND_WAIT_TOOL,
  READ_ASSESSMENT_TOOL,
  READ_CASE_TOOL,
  READ_DOCUMENTS_TOOL,
} from "./tools-shared";

const ENDORSEMENT_AUTHORITIES = ["moccae", "apha"] as const;

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Computes the pre-flight endorsement window, submits to MOCCAE (UAE) or APHA (UK), and tracks the courier.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    READ_CASE_TOOL,
    READ_ASSESSMENT_TOOL,
    READ_DOCUMENTS_TOOL,
    {
      name: "compute_window",
      description:
        "Compute the [earliest, latest] endorsement submission dates relative to the flight date and the corridor's pre-flight window rule.",
      input_schema: {
        type: "object",
        properties: {
          flight_date: { type: "string", description: "YYYY-MM-DD" },
          authority: { type: "string", enum: [...ENDORSEMENT_AUTHORITIES] },
        },
        required: ["flight_date", "authority"],
      },
    },
    {
      name: "submit_endorsement",
      description:
        "Terminal: submit the assembled packet to the named authority. Returns the regulator's submission id.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: [...ENDORSEMENT_AUTHORITIES] },
          submission_payload: {
            type: "object",
            description: "Fields and document_ids the authority requires.",
          },
          submitted_at: { type: "string", description: "ISO 8601 timestamp." },
        },
        required: ["case_id", "authority", "submission_payload", "submitted_at"],
      },
    },
    {
      name: "track_courier",
      description:
        "Persist a courier waybill against the case. Non-terminal — call before emit/clear if a paper-only authority is in play.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          courier: { type: "string", enum: ["dhl", "fedex", "aramex", "ups", "other"] },
          tracking_no: { type: "string" },
        },
        required: ["case_id", "courier", "tracking_no"],
      },
    },
    {
      name: "flag_window_breach",
      description:
        "Terminal: the computed window has already closed or overlaps a regulator holiday. Returns the next viable flight date.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_feasible_flight: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["case_id", "reason"],
      },
    },
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: ["submit_endorsement", "flag_window_breach", "acknowledge_and_wait"],
  budget: { max_turns: 5, max_input_tokens: 40_000 },
});
