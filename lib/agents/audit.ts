// Audit — read-only watchdog. Verifies citation coverage, cross-checks
// deterministic vs LLM verdicts, and flags SLA-breach risk. Posts findings
// back to the orchestrator, which can pause the case mid-flow.

import { type AgentDefinition, validateAgent } from "./types";
import {
  ACKNOWLEDGE_AND_WAIT_TOOL,
  READ_ASSESSMENT_TOOL,
} from "./tools-shared";

const VIOLATION_KINDS = [
  "citation_gap",
  "deterministic_disagreement",
  "sla_breach_risk",
  "low_extraction_confidence",
  "missing_evidence_link",
] as const;

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Audit",
  description:
    "Read-only watchdog. Enforces 100% citation coverage on customer-facing claims, cross-checks deterministic vs LLM verdicts, and flags SLA risk.",
  prompt_path: "lib/prompts/audit.md",
  tools: [
    {
      name: "read_recent_runs",
      description: "Read the last N agent_runs for a case to inspect citation coverage on every emitted artifact.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
        required: ["case_id"],
      },
    },
    READ_ASSESSMENT_TOOL,
    {
      name: "read_outbound_messages",
      description: "Read the N most recent outbound comms_messages on a case. Each cited claim must trace back to a requirement_code.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 30 },
        },
        required: ["case_id"],
      },
    },
    {
      name: "cross_check_deterministic",
      description:
        "Re-run the deterministic evaluator for a requirement_code and compare against the LLM verdict on the latest assessment. Deterministic wins on facts.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          rule_code: { type: "string" },
        },
        required: ["case_id", "rule_code"],
      },
    },
    {
      name: "flag_violation",
      description:
        "Record an audit finding. Non-terminal — Audit may flag multiple violations in one pass before pausing or clearing.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          kind: { type: "string", enum: [...VIOLATION_KINDS] },
          subject_run_id: { type: "string", description: "The agent_runs.id under audit, if applicable." },
          details: { type: "string" },
        },
        required: ["case_id", "kind", "details"],
      },
    },
    {
      name: "pause_case",
      description:
        "Terminal: pause the case for human attention. Use when a citation gap or deterministic disagreement cannot be resolved by re-dispatch.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
    {
      name: "clear_audit",
      description: "Terminal: no violations of concern. Citation coverage is 100%; deterministic + LLM agree.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          summary: { type: "string" },
        },
        required: ["case_id", "summary"],
      },
    },
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: ["pause_case", "clear_audit", "acknowledge_and_wait"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
