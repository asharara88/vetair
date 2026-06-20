// Endorsement — manages the 7–10 day pre-flight endorsement window:
// MOCCAE / APHIS submission, courier dispatch, status polling.

import { type AgentDefinition, validateAgent } from "./types";
import { ACKNOWLEDGE_AND_WAIT } from "./shared-tools";

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement Desk",
  description:
    "Manages the 7–10 day pre-flight endorsement window. Submits the export health certificate to MOCCAE / APHIS / DEFRA, books the courier, and polls until the endorsed certificate is back in hand.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_flight_proposal",
      description: "Read the confirmed flight date so you can compute the legal endorsement window.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_health_certificate",
      description:
        "Read the issued health certificate document (extracted_fields, file_url) and the issuing vet.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_country_rules",
      description: "Read country_rules filtered by corridor + species so you can pin the endorsement window.",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string" },
          destination: { type: "string" },
          species: { type: "string" },
        },
        required: ["origin", "destination", "species"],
      },
    },
    {
      name: "submit_endorsement",
      description:
        "Terminal: submit the export health certificate to the destination authority and write a row to endorsement_submissions.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: {
            type: "string",
            enum: ["MOCCAE", "APHIS", "DEFRA", "CFIA", "DAFF"],
          },
          submission_method: { type: "string", enum: ["portal", "in_person", "courier"] },
          submitted_at: { type: "string", description: "ISO 8601 timestamp." },
          flight_date: { type: "string", description: "ISO YYYY-MM-DD; must be 7–10 days after submission per the rule." },
          cited_rules: {
            type: "array",
            items: { type: "string" },
            description: "Requirement codes covering the endorsement window.",
          },
        },
        required: ["case_id", "authority", "submission_method", "submitted_at", "flight_date", "cited_rules"],
      },
    },
    {
      name: "poll_endorsement_status",
      description:
        "Read the current endorsement_submissions row status without re-submitting. Use to decide whether the case is ready to advance to booking.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "endorsement_window_violation",
      description:
        "Terminal: the flight date no longer fits the legal endorsement window (e.g. flight pushed >10 days out). Escalates back to Orchestrator for re-booking.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          cited_rules: { type: "array", items: { type: "string" } },
        },
        required: ["case_id", "reason", "cited_rules"],
      },
    },
    ACKNOWLEDGE_AND_WAIT,
  ],
  terminal_tools: ["submit_endorsement", "endorsement_window_violation", "acknowledge_and_wait"],
  budget: { max_turns: 5, max_input_tokens: 40_000 },
});
