// Endorsement — government liaison. Schedules the MOCCAE / APHIS / equivalent
// endorsement inside the corridor's legal window (typically 1–10 days pre-flight,
// up to 40 days for Japan). Tracks the courier handoff to the airline.

import { type AgentDefinition, validateAgent } from "./types";

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Government Liaison",
  description:
    "Government endorsement timing. Schedules MOCCAE / APHIS / equivalent submission inside the corridor's legal window and tracks the courier handoff to the airline.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_corridor_rules",
      description:
        "Read the endorsement window + authority for a corridor from sim_endorsement_rules. Returns min/max days before departure and typical processing days.",
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
      name: "read_locked_routing",
      description:
        "Read the locked flight date set by the Airline & Crate agent for this case.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "propose_endorsement_date",
      description:
        "Propose an endorsement appointment date inside the legal window for the orchestrator's consensus round.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          proposed_date: { type: "string", description: "ISO date YYYY-MM-DD" },
          authority_name: { type: "string" },
          rationale: { type: "string" },
        },
        required: ["case_id", "proposed_date", "authority_name"],
      },
    },
    {
      name: "submit_endorsement",
      description:
        "Terminal: submit the endorsement package to the authority. Writes the submission record and notifies Comms.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority_name: { type: "string" },
          submission_date: { type: "string" },
          courier_tracking: { type: "string" },
        },
        required: ["case_id", "authority_name", "submission_date"],
      },
    },
    {
      name: "window_infeasible",
      description:
        "Terminal: the locked flight date falls outside the legal endorsement window. Returns the next feasible flight date.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_feasible_flight_date: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: ["submit_endorsement", "window_infeasible"],
  budget: { max_turns: 5, max_input_tokens: 30_000 },
});
