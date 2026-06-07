// Endorsement — drives the 7–10 day pre-flight endorsement window.
// Books the OV health-certificate appointment, prepares MOCCAE / APHA / USDA
// submission packages, tracks the courier. Cites the endorsement-window rule
// for every action.

import { type AgentDefinition, validateAgent } from "./types";
import { ASK_USER_FOR_INPUT_TOOL } from "./shared-tools";

const AUTHORITIES = ["MOCCAE", "APHA", "USDA", "EU_TRACES"] as const;

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Owns the 7–10 day pre-flight endorsement window. Schedules OV appointments, prepares the authority submission package, and tracks courier delivery.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_flight_lock",
      description:
        "Read the confirmed flight depart_at to anchor the endorsement window. Returns null if no routing is confirmed yet.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "compute_window",
      description:
        "Compute the endorsement window for a given flight + corridor. Returns earliest_issue and latest_issue ISO dates with the rule citation.",
      input_schema: {
        type: "object",
        properties: {
          depart_at: { type: "string" },
          destination: { type: "string" },
          species: { type: "string" },
        },
        required: ["depart_at", "destination"],
      },
    },
    {
      name: "propose_endorsement_appointment",
      description:
        "Terminal: propose an OV appointment slot inside the computed window for the consensus timeline.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          slot: { type: "string", description: "ISO timestamp inside the endorsement window." },
          requirement_code: { type: "string" },
        },
        required: ["case_id", "vet_id", "slot", "requirement_code"],
      },
    },
    {
      name: "submit_to_authority",
      description:
        "Terminal: submit the prepared package to the destination authority (MOCCAE / APHA / USDA / EU_TRACES). Records the submission reference.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: [...AUTHORITIES] },
          submission_reference: { type: "string" },
          requirement_code: { type: "string" },
        },
        required: ["case_id", "authority", "submission_reference", "requirement_code"],
      },
    },
    {
      name: "track_courier",
      description:
        "Terminal: register a courier tracking number for the signed endorsement returning to the case file.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier: { type: "string", description: "e.g. DHL, FedEx, Aramex." },
          tracking_number: { type: "string" },
          expected_arrival: { type: "string", description: "ISO date." },
        },
        required: ["case_id", "carrier", "tracking_number"],
      },
    },
    ASK_USER_FOR_INPUT_TOOL,
    {
      name: "window_infeasible",
      description:
        "Terminal: the endorsement window cannot be met (e.g. flight too soon for the corridor's wait period). Returns the binding constraint.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_feasible_departure: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: [
    "propose_endorsement_appointment",
    "submit_to_authority",
    "track_courier",
    "ask_user_for_input",
    "window_infeasible",
  ],
  budget: { max_turns: 6, max_input_tokens: 50_000 },
});
