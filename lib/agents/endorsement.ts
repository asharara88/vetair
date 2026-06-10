// Endorsement — owns the pre-flight government-vet endorsement window.
// MOCCAE (UAE), APHA (UK), USDA APHIS (US). The prompt enforces window math;
// this file types the submit / schedule / track surface.

import { type AgentDefinition, validateAgent } from "./types";

const AUTHORITY_ENUM = ["MOCCAE", "APHA", "USDA_APHIS", "CFIA", "AQIS"] as const;

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Owns the endorsement window. Confirms the appointment falls inside the destination's pre-flight window, submits to the authority, tracks the courier.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_itinerary",
      description: "Read the active itinerary so the window math has a flight date.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_country_rules",
      description: "Read corridor rules. The destination rule supplies the endorsement window in `time_constraints`.",
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
      name: "check_window",
      description: "Verify that an endorsement date sits inside the destination's pre-flight window.",
      input_schema: {
        type: "object",
        properties: {
          flight_date: { type: "string" },
          endorsement_date: { type: "string" },
        },
        required: ["flight_date", "endorsement_date"],
      },
    },
    {
      name: "schedule_submission",
      description: "Terminal: queue a submission for the window-open date. Used when today is before the lower bound.",
      input_schema: {
        type: "object",
        properties: {
          submit_at_iso: { type: "string" },
          authority: { type: "string", enum: [...AUTHORITY_ENUM] },
        },
        required: ["submit_at_iso", "authority"],
      },
    },
    {
      name: "submit_endorsement",
      description: "Terminal: submit the health-certificate package to the authority.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: [...AUTHORITY_ENUM] },
          payload: { type: "object", description: "Authority-specific submission payload." },
        },
        required: ["case_id", "authority", "payload"],
      },
    },
    {
      name: "record_tracking",
      description: "Terminal: attach a courier tracking number to a submitted endorsement.",
      input_schema: {
        type: "object",
        properties: {
          submission_id: { type: "string" },
          tracking_number: { type: "string" },
          courier: { type: "string" },
        },
        required: ["submission_id", "tracking_number", "courier"],
      },
    },
    {
      name: "escalate_window_missed",
      description: "Terminal: today is past the window's upper bound. Propose a new flight date in the reason.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: [
    "schedule_submission",
    "submit_endorsement",
    "record_tracking",
    "escalate_window_missed",
  ],
  budget: { max_turns: 4, max_input_tokens: 40_000 },
});
