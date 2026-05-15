// Endorsement — times the 10-day pre-flight endorsement window and tracks
// the MOCCAE (UAE) or APHA (UK) export endorsement submission. Reads the
// approved flight from the consensus timeline, computes the legal submission
// window, and either lodges the submission or schedules it.

import { type AgentDefinition, validateAgent } from "./types";

const AUTHORITIES = ["MOCCAE", "APHA", "USDA-APHIS", "DEFRA"] as const;

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Times the 10-day pre-flight endorsement window and tracks MOCCAE / APHA submissions through to courier delivery.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_case_timeline",
      description:
        "Read the latest flight proposal, vet appointments, and health certificate status for a case.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_country_rules",
      description:
        "Read the country_rules entries that govern the export endorsement window for this corridor + species.",
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
      name: "compute_submission_window",
      description:
        "Return the [earliest, latest] ISO dates the endorsement may be submitted for the given departure.",
      input_schema: {
        type: "object",
        properties: {
          depart_at: { type: "string" },
          window_days: {
            type: "integer",
            minimum: 1,
            maximum: 30,
            description: "Number of days before departure the endorsement is valid (typically 10).",
          },
        },
        required: ["depart_at", "window_days"],
      },
    },
    {
      name: "submit_endorsement",
      description:
        "Terminal: lodge the export endorsement with the named authority. Includes the submission reference and courier ETA.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: [...AUTHORITIES] },
          submitted_at: { type: "string", description: "ISO 8601 UTC timestamp of submission." },
          reference: { type: "string", description: "Authority-issued submission/reference number." },
          requirement_code: { type: "string", description: "Country rule this endorsement satisfies." },
          courier_eta: {
            type: "string",
            description: "ISO 8601 expected arrival of the physical endorsement at the airport.",
          },
        },
        required: ["case_id", "authority", "submitted_at", "reference", "requirement_code"],
      },
    },
    {
      name: "schedule_endorsement",
      description:
        "Terminal: too early to submit — schedule the submission for the start of the valid window. Orchestrator wakes the agent again at that time.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: [...AUTHORITIES] },
          submit_after: { type: "string", description: "ISO 8601 — earliest legal submission moment." },
          requirement_code: { type: "string" },
        },
        required: ["case_id", "authority", "submit_after", "requirement_code"],
      },
    },
    {
      name: "block_endorsement",
      description:
        "Terminal: a prerequisite is missing or the window has elapsed. Returns to orchestrator with a structured blocker.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          missing_requirement_codes: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: ["submit_endorsement", "schedule_endorsement", "block_endorsement"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
