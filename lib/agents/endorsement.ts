// Endorsement — pins the 7–10 day pre-flight endorsement window, submits to the
// destination authority (MOCCAE for UAE-bound, APHA for UK-bound), and tracks
// the courier until the endorsed cert is back in the owner's hands.

import { type AgentDefinition, validateAgent } from "./types";

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement Team",
  description:
    "Pins the 7–10 day pre-flight endorsement window, submits to MOCCAE/APHA, and tracks the courier until the endorsed cert is delivered.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "compute_endorsement_window",
      description:
        "From the locked flight date, compute the legal endorsement window (e.g. 10 days for UK APHA, 5 days for UAE MOCCAE).",
      input_schema: {
        type: "object",
        properties: {
          flight_date: { type: "string", description: "YYYY-MM-DD" },
          destination: { type: "string", description: "ISO-3166 alpha-2" },
          species: { type: "string" },
        },
        required: ["flight_date", "destination", "species"],
      },
    },
    {
      name: "read_health_certificate",
      description: "Read the most recent uploaded health certificate, including issuing vet + issue date.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "schedule_endorsement",
      description:
        "Terminal: enqueue the endorsement appointment with the issuing vet on a date inside the legal window.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD" },
          authority: { type: "string", enum: ["APHA", "MOCCAE", "USDA_APHIS", "CFIA", "other"] },
          cited_rules: { type: "array", items: { type: "string" } },
        },
        required: ["case_id", "vet_id", "date", "authority", "cited_rules"],
      },
    },
    {
      name: "submit_to_authority",
      description: "Terminal: submit the endorsed health certificate package to the destination authority portal.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: ["APHA", "MOCCAE", "USDA_APHIS", "CFIA", "other"] },
          submission_payload: {
            type: "object",
            description: "Authority-specific fields (e.g. APHA reference number, MOCCAE permit_id).",
          },
        },
        required: ["case_id", "authority", "submission_payload"],
      },
    },
    {
      name: "track_courier",
      description: "Read courier tracking events for the endorsed certificate return-leg.",
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
      name: "window_infeasible",
      description:
        "Terminal: the endorsement window cannot be honoured against the locked flight date (e.g. authority backlog). Escalates back to Orchestrator for re-consensus.",
      input_schema: {
        type: "object",
        properties: {
          reason: { type: "string" },
          earliest_feasible_date: { type: "string", description: "YYYY-MM-DD if known" },
        },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: ["schedule_endorsement", "submit_to_authority", "window_infeasible"],
  budget: { max_turns: 5, max_input_tokens: 40_000 },
});
