// Endorsement — owns the 10-day pre-flight endorsement window. Coordinates
// the OV signature, MOCCAE / APHIS submission, and courier tracking.

import { type AgentDefinition, type AgentTool, validateAgent } from "./types";

const TOOLS: AgentTool[] = [
  {
    name: "read_routing",
    description: "Read the locked airline routing — departure timestamp anchors the endorsement window.",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  },
  {
    name: "read_appointments",
    description: "Read the booked vet appointment plan so we know when the OV health certificate will be signed.",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  },
  {
    name: "read_endorsement_authority",
    description: "Look up the destination's endorsement authority (MOCCAE / APHIS / DEFRA) — submission portal, courier requirements, SLA.",
    input_schema: {
      type: "object",
      properties: {
        origin_country: { type: "string" },
        destination_country: { type: "string" },
      },
      required: ["origin_country", "destination_country"],
    },
  },
  {
    name: "emit_endorsement_plan",
    description:
      "Terminal: lock the submission + courier plan. `health_cert_signed_on` must fall within the corridor's endorsement window pre-departure.",
    input_schema: {
      type: "object",
      properties: {
        authority: { type: "string", description: "MOCCAE | APHIS | DEFRA | ..." },
        health_cert_signed_on: { type: "string", description: "YYYY-MM-DD" },
        submitted_on: { type: "string", description: "YYYY-MM-DD" },
        endorsement_due_by: { type: "string", description: "YYYY-MM-DD — latest date the authority must return the endorsed cert." },
        courier_service: { type: "string" },
        cited_rules: { type: "array", items: { type: "string" } },
      },
      required: [
        "authority",
        "health_cert_signed_on",
        "submitted_on",
        "endorsement_due_by",
        "cited_rules",
      ],
    },
  },
  {
    name: "flag_window_breach",
    description:
      "Terminal: the endorsement window cannot be met given the locked routing + vet appointment. Routes to Orchestrator for re-sequencing.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string" },
        earliest_feasible_departure: { type: "string", description: "YYYY-MM-DD" },
        cited_rules: { type: "array", items: { type: "string" } },
      },
      required: ["reason", "cited_rules"],
    },
  },
  {
    name: "acknowledge_and_wait",
    description: "Terminal: routing and appointments are not yet both locked; nothing to plan. Yield until both upstream agents complete.",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string" } },
      required: ["reason"],
    },
  },
];

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Owns the pre-flight endorsement window. Schedules the OV signature, agency submission, and courier so the endorsed cert is in hand before departure.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: TOOLS,
  terminal_tools: ["emit_endorsement_plan", "flag_window_breach", "acknowledge_and_wait"],
  budget: { max_turns: 5, max_input_tokens: 30_000 },
});
