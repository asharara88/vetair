// Endorsement — third proposer in the consensus timeline loop (§2.2).
// Owns the 7–10-day pre-flight endorsement window: MOCCAE / APHA submission,
// courier tracking, validity arithmetic.

import { type AgentDefinition, validateAgent } from "./types";

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Owns the 7–10 day pre-flight endorsement window: MOCCAE / APHA submission, courier tracking, validity arithmetic.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_assessment",
      description:
        "Read the most recent compliance assessment for the case (verdict + cited_rules + requirements_missing).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_country_rules",
      description: "Read the country_rules table filtered by corridor + species — for the endorsement window codes.",
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
      name: "compute_endorsement_window",
      description:
        "Compute the legal endorsement window (earliest + latest issue date) given a target travel date and the corridor's pre-flight wait.",
      input_schema: {
        type: "object",
        properties: {
          target_travel_date: { type: "string", description: "YYYY-MM-DD" },
          pre_flight_window_days: { type: "integer", minimum: 1, maximum: 30 },
        },
        required: ["target_travel_date", "pre_flight_window_days"],
      },
    },
    {
      name: "track_courier",
      description: "Read the most recent courier tracking event for an outbound endorsement packet.",
      input_schema: {
        type: "object",
        properties: { tracking_id: { type: "string" } },
        required: ["tracking_id"],
      },
    },
    {
      name: "emit_endorsement_proposal",
      description:
        "Terminal: propose the endorsement issue date and submission lane (MOCCAE for UAE outbound, APHA for UK outbound). Cited rules must justify the window arithmetic.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          lane: { type: "string", enum: ["MOCCAE", "APHA", "USDA", "OTHER"] },
          earliest_issue_date: { type: "string", description: "YYYY-MM-DD" },
          latest_issue_date: { type: "string", description: "YYYY-MM-DD" },
          courier_required: { type: "boolean" },
          cited_rules: { type: "array", items: { type: "string" } },
        },
        required: [
          "case_id",
          "lane",
          "earliest_issue_date",
          "latest_issue_date",
          "courier_required",
          "cited_rules",
        ],
      },
    },
    {
      name: "fail_endorsement",
      description:
        "Terminal: window is impossible — target travel date is too soon, or the upstream health certificate hasn't been issued.",
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
  terminal_tools: ["emit_endorsement_proposal", "fail_endorsement"],
  budget: { max_turns: 5, max_input_tokens: 30_000 },
});
