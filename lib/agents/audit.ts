// Audit — read-only watchdog. Monitors every other agent's output for
// citation gaps, deterministic vs LLM disagreement, low document confidence,
// and SLA breach risk. Does not act on the case; it raises findings that the
// Orchestrator routes (escalate to human, pause for re-review, or ignore).
//
// Distinct from `auditor` (the adversarial compliance reviewer that votes in
// the 3-voice spine). Audit is portfolio-level, runs async, and never blocks
// a single dispatch.

import { type AgentDefinition, type AgentTool, validateAgent } from "./types";

const TOOLS: AgentTool[] = [
  {
    name: "read_recent_runs",
    description: "Read the last N agent_runs across all agents for a case (or globally if case_id is omitted).",
    input_schema: {
      type: "object",
      properties: {
        case_id: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      required: ["limit"],
    },
  },
  {
    name: "read_assessment",
    description: "Read the most recent compliance assessment (verdict, cited_rules[], requirements_missing[]).",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  },
  {
    name: "read_outbound_messages",
    description: "Read the last N outbound owner-facing messages with their cited_rules[].",
    input_schema: {
      type: "object",
      properties: {
        case_id: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      required: ["case_id", "limit"],
    },
  },
  {
    name: "read_document_extractions",
    description: "Read every document's extracted_fields + extraction_confidence for a case.",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  },
  {
    name: "run_deterministic",
    description: "Re-run the deterministic TS evaluator for a single requirement_code. Used to verify the primary's verdict on facts.",
    input_schema: {
      type: "object",
      properties: { rule_code: { type: "string" } },
      required: ["rule_code"],
    },
  },
  {
    name: "emit_audit_report",
    description: "Terminal: a clean report. No findings. Use when every check passed.",
    input_schema: {
      type: "object",
      properties: {
        case_id: { type: "string" },
        checks_run: { type: "array", items: { type: "string" } },
      },
      required: ["case_id", "checks_run"],
    },
  },
  {
    name: "flag_findings",
    description:
      "Terminal: at least one watchdog check failed. Each finding has a code, severity, and the offending artifact reference. Orchestrator decides whether to pause the case, escalate, or rerun an agent.",
    input_schema: {
      type: "object",
      properties: {
        case_id: { type: "string" },
        findings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              code: {
                type: "string",
                enum: [
                  "citation_gap",
                  "deterministic_disagreement",
                  "low_document_confidence",
                  "sla_breach_risk",
                  "missing_terminal",
                  "invented_requirement_code",
                ],
              },
              severity: { type: "string", enum: ["info", "warn", "critical"] },
              artifact_ref: {
                type: "string",
                description: "Stable handle for the offending row (run_id, message_id, document_id, etc.).",
              },
              detail: { type: "string" },
            },
            required: ["code", "severity", "artifact_ref", "detail"],
          },
          minItems: 1,
        },
      },
      required: ["case_id", "findings"],
    },
  },
  {
    name: "acknowledge_and_wait",
    description: "Terminal: nothing new to audit on this case since the last run. Yield without writing.",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string" } },
      required: ["reason"],
    },
  },
];

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Audit Watchdog",
  description:
    "Read-only watchdog. Verifies citation coverage, deterministic vs LLM agreement, document extraction confidence, and SLA risk. Raises findings; never acts on a case.",
  prompt_path: "lib/prompts/audit.md",
  tools: TOOLS,
  terminal_tools: ["emit_audit_report", "flag_findings", "acknowledge_and_wait"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
