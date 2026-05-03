// Endorsement — health-cert endorsement timing, MOCCAE/APHA submission,
// courier tracking. Owns the 7-10 day pre-flight window math.

import { type AgentDefinition, validateAgent } from "./types";
import { ACKNOWLEDGE_AND_WAIT_TOOL } from "./shared-tools";

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Owns the 7-10 day pre-flight endorsement window: schedules the OV appointment, files MOCCAE / APHA submissions, tracks the courier delivering the wet-stamp packet.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_case_window",
      description: "Read the case's target_date, earliest_legal_departure, and confirmed flight depart_date.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_documents",
      description: "Read documents linked to the case (looking for the OV-signed health certificate and any prior endorsements).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "compute_endorsement_window",
      description: "Run the deterministic window calculator. Returns the [open, close] dates the endorsement must fall within for the confirmed flight.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "propose_endorsement_date",
      description: "Propose (do not commit) the endorsement appointment date. Adds it to the consensus round payload.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: ["MOCCAE", "APHA", "USDA-APHIS", "CFIA", "DAFM", "other"] },
          date: { type: "string", description: "YYYY-MM-DD" },
          notes: { type: "string" },
        },
        required: ["case_id", "authority", "date"],
      },
    },
    {
      name: "submit_endorsement",
      description: "Terminal: file the endorsement with the destination authority once the timeline consensus has resolved.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: ["MOCCAE", "APHA", "USDA-APHIS", "CFIA", "DAFM", "other"] },
          submission_date: { type: "string", description: "YYYY-MM-DD" },
          courier: { type: "string", description: "Courier handle (e.g. DHL, Aramex). Null for digital-only authorities." },
          tracking_number: { type: "string" },
        },
        required: ["case_id", "authority", "submission_date"],
      },
    },
    {
      name: "window_violation",
      description: "Terminal: the confirmed flight cannot be served within the 7-10 day window. Hands the case back to the Orchestrator for re-planning.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_feasible_flight: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["case_id", "reason"],
      },
    },
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: ["submit_endorsement", "window_violation", "acknowledge_and_wait"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
