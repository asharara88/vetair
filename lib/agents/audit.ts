// Audit — read-only watchdog. Runs async over every other agent's output,
// flagging citation gaps, deterministic-vs-LLM disagreements, SLA breach
// risk, and low-confidence document extractions. Posts findings back to the
// orchestrator, which may pause a case mid-flow.

import { type AgentDefinition, validateAgent } from "./types";

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Watchdog",
  description:
    "Read-only watchdog. Async-monitors every agent's output for citation gaps, deterministic-vs-LLM disagreement, SLA breach risk, and low-confidence extractions.",
  prompt_path: "lib/prompts/audit.md",
  tools: [
    {
      name: "read_recent_runs",
      description: "Read the last N agent_runs for a case (any agent).",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
        required: ["case_id"],
      },
    },
    {
      name: "read_compliance_assessment",
      description: "Read the most recent compliance assessment for a case.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_audit_review",
      description: "Read the most recent auditor concur/dissent on the assessment.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_outbound_messages",
      description:
        "Read outbound owner-facing messages and their declared cited_rules. Used to verify every regulatory claim traces back to a requirement_code.",
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
      name: "read_document_extractions",
      description: "Read every document's extraction confidence + classification for a case.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_case_sla",
      description:
        "Read the case's SLA targets and elapsed time. Returns { state, time_in_state_ms, sla_target_ms, breach_risk }.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "flag_finding",
      description:
        "Terminal: post a single finding to the orchestrator. Severity drives the response: `info` is logged only; `warn` annotates the case; `critical` pauses the case.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          finding_type: {
            type: "string",
            enum: [
              "citation_gap",
              "deterministic_disagreement",
              "low_extraction_confidence",
              "sla_breach_risk",
              "missing_audit_review",
              "stale_assessment",
            ],
          },
          severity: { type: "string", enum: ["info", "warn", "critical"] },
          detail: { type: "string" },
          subject_id: {
            type: "string",
            description:
              "The id of the row the finding is about (assessment_id, message_id, document_id, …).",
          },
        },
        required: ["case_id", "finding_type", "severity", "detail"],
      },
    },
    {
      name: "pass_audit",
      description:
        "Terminal: case is in good standing — no findings to raise this round.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          checks_performed: {
            type: "array",
            items: { type: "string" },
            description: "Named checks that ran and passed (for the audit trail).",
          },
        },
        required: ["case_id", "checks_performed"],
      },
    },
  ],
  terminal_tools: ["flag_finding", "pass_audit"],
  budget: { max_turns: 4, max_input_tokens: 40_000 },
});
