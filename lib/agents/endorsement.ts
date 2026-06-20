// Endorsement — government endorsement leg (APHA / MOCCAE / USDA).
// Assembles the packet, submits inside the legal pre-flight window,
// tracks the courier until the endorsement is in hand.

import { type AgentDefinition, validateAgent } from "./types";

const AUTHORITIES = ["MOCCAE", "APHA", "USDA"] as const;
const STATUSES = [
  "pending_submission",
  "submitted_awaiting_endorsement",
  "endorsed_in_transit",
  "received",
  "blocked",
] as const;

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Government endorsement workflow. Assembles the packet, submits to MOCCAE/APHA/USDA inside the legal pre-flight window, tracks the courier until the endorsement is in hand.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "compute_endorsement_window",
      description:
        "Compute the jurisdiction-defined endorsement window (open/close dates) for the corridor and flight date.",
      input_schema: {
        type: "object",
        properties: {
          target_flight_date: { type: "string" },
          origin_country: { type: "string" },
          destination_country: { type: "string" },
        },
        required: ["target_flight_date", "origin_country", "destination_country"],
      },
    },
    {
      name: "assemble_packet",
      description:
        "Gather all documents needed for the endorsement submission. Returns ready=true with packet_url, or ready=false with the missing items.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "submit_endorsement",
      description: "Submit the assembled packet to the named authority.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: [...AUTHORITIES] },
          packet_url: { type: "string" },
          requirement_code: { type: "string" },
        },
        required: ["case_id", "authority", "packet_url", "requirement_code"],
      },
    },
    {
      name: "track_courier",
      description: "Fetch the current courier status for a submitted endorsement packet.",
      input_schema: {
        type: "object",
        properties: { submission_id: { type: "string" } },
        required: ["submission_id"],
      },
    },
    {
      name: "emit_endorsement_status",
      description:
        "Terminal: persist the current endorsement status. Every status must cite a requirement_code.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          status: { type: "string", enum: [...STATUSES] },
          citation: { type: "string" },
          courier_eta: { type: "string" },
        },
        required: ["case_id", "status", "citation"],
      },
    },
    {
      name: "escalate_window_missed",
      description:
        "Terminal: the legal endorsement window has already closed relative to the flight date. Orchestrator must re-negotiate the flight.",
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
  terminal_tools: ["emit_endorsement_status", "escalate_window_missed"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
