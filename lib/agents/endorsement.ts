// Endorsement — 10-day window timing, MOCCAE / APHIS submission, courier
// tracking. Third voice in the consensus-timeline loop: given a flight
// proposal from airline_crate and a vet appointment from vet_network,
// emits the latest legal endorsement appointment and submission plan.

import { type AgentDefinition, validateAgent } from "./types";

const AUTHORITIES = ["MOCCAE", "APHIS", "DEFRA", "AQIS", "CFIA"] as const;

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Enforces the 10-day pre-flight endorsement window, drafts MOCCAE/APHIS submissions, and tracks courier delivery of the stamped certificate.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_case_facts",
      description: "Read the case's corridor, pet, proposed flight date, and proposed vet appointment.",
      input_schema: {
        type: "object" as const,
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_endorsement_authority",
      description:
        "Deterministic: resolve the correct endorsement authority + processing SLA for an origin country / destination pair.",
      input_schema: {
        type: "object" as const,
        properties: {
          origin_country: { type: "string" },
          destination_country: { type: "string" },
        },
        required: ["origin_country", "destination_country"],
      },
    },
    {
      name: "compute_window",
      description:
        "Deterministic: given a flight date, return the earliest and latest legal endorsement dates (typically flight_date−10 .. flight_date−1).",
      input_schema: {
        type: "object" as const,
        properties: {
          flight_date: { type: "string", description: "ISO date (YYYY-MM-DD)." },
          authority: { type: "string", enum: [...AUTHORITIES] },
        },
        required: ["flight_date", "authority"],
      },
    },
    {
      name: "emit_endorsement_plan",
      description:
        "Terminal: emit the endorsement appointment + submission plan. Every claim must cite a requirement_code.",
      input_schema: {
        type: "object" as const,
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: [...AUTHORITIES] },
          vet_appointment_date: { type: "string", description: "ISO date (YYYY-MM-DD)." },
          submission_date: { type: "string", description: "ISO date (YYYY-MM-DD)." },
          flight_date: { type: "string", description: "ISO date (YYYY-MM-DD)." },
          courier_pickup_window: {
            type: "object",
            properties: {
              earliest: { type: "string" },
              latest: { type: "string" },
            },
          },
          satisfies_rules: {
            type: "array",
            items: { type: "string" },
            description: "requirement_codes satisfied by this plan.",
          },
          notes: { type: "string" },
        },
        required: [
          "case_id",
          "authority",
          "vet_appointment_date",
          "submission_date",
          "flight_date",
          "satisfies_rules",
        ],
      },
    },
    {
      name: "window_infeasible",
      description:
        "Terminal: the 10-day endorsement window cannot be met given the proposed vet + flight dates. Escalates to the orchestrator.",
      input_schema: {
        type: "object" as const,
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_feasible_flight_date: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: ["emit_endorsement_plan", "window_infeasible"],
  budget: { max_turns: 5, max_input_tokens: 30_000 },
});

export const ENDORSEMENT_AUTHORITIES = AUTHORITIES;
