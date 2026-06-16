// Endorsement — schedules the 7-10 day pre-flight endorsement window with the
// state vet authority (MOCCAE for UAE outbound, APHA for UK outbound, USDA for
// US outbound). Cross-checks the vet exam slot, calculates the legal window
// from the proposed flight, and proposes a courier-or-walk-in submission slot.

import { type AgentDefinition, validateAgent } from "./types";

const AUTHORITY = ["MOCCAE", "APHA", "USDA", "AGES", "AQIS"] as const;

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement Team",
  description:
    "Schedules the 7-10 day pre-flight endorsement window with the state vet authority (MOCCAE / APHA / USDA). Cross-checks the vet exam and proposes a submission slot.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_case",
      description: "Read the case (origin_country, destination_country, target_date, earliest_legal_departure).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_proposed_flight",
      description: "Read the current proposed flight slot from the consensus timeline, if any. Returns null if no flight has been proposed yet.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_proposed_vet_visit",
      description: "Read the current proposed pre-travel vet exam slot, if any. The endorsement window starts from when the OV signs the health certificate.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "compute_endorsement_window",
      description:
        "Compute the legal endorsement window for an authority + flight pair (typically [flight-10d, flight-1d]). Returns an ISO date range.",
      input_schema: {
        type: "object",
        properties: {
          authority: { type: "string", enum: [...AUTHORITY] },
          flight_departure_utc: { type: "string" },
        },
        required: ["authority", "flight_departure_utc"],
      },
    },
    {
      name: "list_authority_slots",
      description: "List submission slots for an authority inside a date range (walk-in counter or courier pickup).",
      input_schema: {
        type: "object",
        properties: {
          authority: { type: "string", enum: [...AUTHORITY] },
          from_date: { type: "string", description: "YYYY-MM-DD" },
          to_date: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["authority", "from_date", "to_date"],
      },
    },
    {
      name: "propose_endorsement",
      description:
        "Terminal: emit a proposed endorsement submission slot. The slot MUST fall inside the computed window AND after the vet exam slot.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: [...AUTHORITY] },
          submission_method: { type: "string", enum: ["walk_in", "courier", "online_portal"] },
          slot_start: { type: "string", description: "ISO 8601 timestamp" },
          slot_end: { type: "string", description: "ISO 8601 timestamp" },
          window_start: { type: "string", description: "ISO date — earliest legal submission" },
          window_end: { type: "string", description: "ISO date — latest legal submission" },
          rationale: { type: "string" },
        },
        required: [
          "case_id",
          "authority",
          "submission_method",
          "slot_start",
          "slot_end",
          "window_start",
          "window_end",
          "rationale",
        ],
      },
    },
    {
      name: "request_prerequisite",
      description:
        "Terminal: report that a prerequisite is missing (e.g. no flight proposed yet, no vet visit proposed yet). The orchestrator will re-dispatch the prerequisite agent before re-running endorsement.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          missing: { type: "string", enum: ["proposed_flight", "proposed_vet_visit"] },
        },
        required: ["case_id", "missing"],
      },
    },
    {
      name: "block_endorsement",
      description:
        "Terminal: report that no submission slot exists inside the legal window. The orchestrator will widen the flight window and re-loop.",
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
  terminal_tools: ["propose_endorsement", "request_prerequisite", "block_endorsement"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});

export const ENDORSEMENT_AUTHORITY = AUTHORITY;
