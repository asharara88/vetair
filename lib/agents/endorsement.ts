// Endorsement — times the official veterinary endorsement to the booked flight
// (the 7–10 day pre-flight window), submits to the destination authority
// (MOCCAE / APHA / USDA-APHIS), and tracks the courier leg.

import { type AgentDefinition, validateAgent } from "./types";

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement Team",
  description:
    "Times the official endorsement to the 7–10 day pre-flight window, submits to MOCCAE / APHA / USDA-APHIS, and tracks the courier leg.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_case_plan",
      description: "Read the booked flight_date, target_date, and corridor for this case.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_assessment",
      description: "Read the latest compliance assessment. Endorsement may only proceed once the verdict is approved.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "compute_endorsement_window",
      description:
        "Compute the legal endorsement submission window from the booked flight date. Deterministic — never derive the window by hand.",
      input_schema: {
        type: "object",
        properties: {
          flight_date: { type: "string", description: "YYYY-MM-DD" },
          origin: { type: "string" },
        },
        required: ["flight_date", "origin"],
      },
    },
    {
      name: "propose_endorsement",
      description: "Terminal: submit a candidate endorsement date into the timeline consensus round. Must fall inside the computed window.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          submission_date: { type: "string", description: "YYYY-MM-DD" },
          window_open: { type: "string", description: "YYYY-MM-DD" },
          window_close: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["case_id", "submission_date", "window_open", "window_close"],
      },
    },
    {
      name: "submit_endorsement",
      description: "Terminal: submit the endorsement package to the authority once the plan is locked.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: ["MOCCAE", "APHA", "USDA_APHIS", "other"] },
          appointment_date: { type: "string", description: "YYYY-MM-DD" },
          courier_ref: { type: "string", description: "Tracking reference for the physical endorsement leg, if applicable" },
        },
        required: ["case_id", "authority", "appointment_date"],
      },
    },
    {
      name: "ask_user_for_input",
      description: "Terminal: ask the owner via Comms for a missing fact (e.g. confirming the OV appointment they attended).",
      input_schema: {
        type: "object",
        properties: {
          field: { type: "string" },
          question: { type: "string" },
        },
        required: ["field", "question"],
      },
    },
  ],
  terminal_tools: ["propose_endorsement", "submit_endorsement", "ask_user_for_input"],
  budget: { max_turns: 8, max_input_tokens: 60_000 },
});
