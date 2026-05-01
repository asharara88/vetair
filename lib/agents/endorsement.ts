// Endorsement — schedules and tracks the government health-certificate endorsement.
// Most destinations require submission to MOCCAE/APHA/USDA inside a 7–10 day
// window before flight. Owns that timing.

import { type AgentDefinition, validateAgent } from "./types";

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Owns the 7–10 day government endorsement window. Computes submission dates, prepares the packet, tracks the courier.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_assessment",
      description: "Read the latest compliance assessment for the case.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_route_proposal",
      description: "Read the airline_crate proposal so you know the flight date the window must align with.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_documents",
      description: "Read all documents on the case so you can confirm the packet is complete before submission.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "compute_window",
      description:
        "Compute the legal endorsement submission window for a destination authority and travel date. Returns ISO start + end dates.",
      input_schema: {
        type: "object",
        properties: {
          authority: { type: "string", enum: ["MOCCAE", "APHA", "USDA", "CFIA", "DAFF", "AQSIQ"] },
          travel_date: { type: "string" },
        },
        required: ["authority", "travel_date"],
      },
    },
    {
      name: "schedule_submission",
      description:
        "Terminal: lock the submission slate. `submission_date` MUST fall inside the computed window. Cited rules trace back to `country_rules`.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string" },
          submission_date: { type: "string" },
          window_start: { type: "string" },
          window_end: { type: "string" },
          packet_documents: { type: "array", items: { type: "string" } },
          cited_rules: { type: "array", items: { type: "string" } },
        },
        required: [
          "case_id",
          "authority",
          "submission_date",
          "window_start",
          "window_end",
          "packet_documents",
          "cited_rules",
        ],
      },
    },
    {
      name: "block_window_missed",
      description:
        "Terminal: the travel date is too close (or too far) for the window to be feasible. Caller will renegotiate dates with the owner.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_feasible_travel_date: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: ["schedule_submission", "block_window_missed"],
  budget: { max_turns: 5, max_input_tokens: 40_000 },
});
