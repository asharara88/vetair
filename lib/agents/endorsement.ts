// Endorsement — manages the 7–10 day pre-flight endorsement window:
// MOCCAE (UAE), APHIS (US), AHC (UK). Books the endorsement visit date,
// submits the health certificate, and tracks the courier leg.

import { type AgentDefinition, validateAgent } from "./types";
import { ACKNOWLEDGE_AND_WAIT_TOOL } from "./shared-tools";

const AUTHORITIES = ["MOCCAE", "APHIS", "AHC", "AVA", "MAFF"] as const;

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Books the 7–10 day pre-flight endorsement visit, submits to the destination authority (MOCCAE / APHIS / AHC), and tracks the courier leg.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_case_facts",
      description: "Read case facts: corridor, target flight date, vet appointment dates, existing endorsement rows.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_booking",
      description: "Read the latest airline_crate booking proposal to anchor the endorsement window to the actual flight date.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "compute_window",
      description:
        "Compute the [earliest, latest] endorsement visit dates for a given flight date and destination authority. Deterministic.",
      input_schema: {
        type: "object",
        properties: {
          flight_date: { type: "string", description: "YYYY-MM-DD" },
          authority: { type: "string", enum: [...AUTHORITIES] },
        },
        required: ["flight_date", "authority"],
      },
    },
    {
      name: "submit_to_authority",
      description:
        "Submit the endorsement package to the destination authority's portal (or stub-queue when the portal is manual). Records a submission row.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: [...AUTHORITIES] },
          package_document_ids: {
            type: "array",
            items: { type: "string" },
            description: "document rows constituting the submission (health cert, titer, permit).",
          },
        },
        required: ["case_id", "authority", "package_document_ids"],
      },
    },
    {
      name: "propose_endorsement_plan",
      description:
        "Terminal: emit the endorsement plan for the timeline consensus. Must include visit datetime, authority submission date, courier eta, and the flight date this is anchored to.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: [...AUTHORITIES] },
          visit_at: { type: "string", description: "ISO 8601 datetime of the OV / vet endorsement visit" },
          submission_at: { type: "string", description: "ISO 8601 datetime of the authority submission" },
          courier_eta: { type: "string", description: "YYYY-MM-DD when the endorsed certificate returns" },
          anchored_flight_date: { type: "string", description: "YYYY-MM-DD" },
          rationale: { type: "string" },
        },
        required: [
          "case_id",
          "authority",
          "visit_at",
          "submission_at",
          "courier_eta",
          "anchored_flight_date",
          "rationale",
        ],
      },
    },
    {
      name: "block_endorsement",
      description:
        "Terminal: the [earliest, latest] window is infeasible (flight too soon, missing prerequisite document). Escalate so Comms can renegotiate the flight date or chase a document.",
      input_schema: {
        type: "object",
        properties: {
          reason: { type: "string" },
          missing_requirement_codes: { type: "array", items: { type: "string" } },
        },
        required: ["reason"],
      },
    },
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: ["propose_endorsement_plan", "block_endorsement", "acknowledge_and_wait"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});

export const ENDORSEMENT_AUTHORITIES = AUTHORITIES;
