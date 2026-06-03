// Audit — read-only watchdog. Runs async after every other agent and flags:
//   1. Citation coverage <100% on customer-facing claims
//   2. Deterministic vs LLM disagreement on factual matters
//   3. SLA breach risk
//   4. Document extraction confidence below 0.95
// Cannot mutate case state — only writes findings and (rarely) pauses the case.

import { type AgentDefinition, validateAgent } from "./types";
import { ACKNOWLEDGE_AND_WAIT } from "./tools";

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Audit",
  description:
    "Read-only watchdog. Verifies citation coverage, flags deterministic-vs-LLM disagreement, surfaces SLA risk and low-confidence extractions.",
  prompt_path: "lib/prompts/audit.md",
  tools: [
    {
      name: "read_recent_runs",
      description: "Read the last N agent_runs for a case so you can audit them in order.",
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
      name: "read_outbound_messages",
      description:
        "Read all outbound comms_messages for a case so citation coverage can be checked against assessment.cited_rules.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_assessment",
      description: "Read the latest compliance assessment.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_extractions",
      description: "Read all document extractions on the case (with confidence scores).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "emit_findings",
      description:
        "Terminal: write the audit report. `severity` is `ok` when no findings, `warn` for advisory issues, `critical` if the case must be paused.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          severity: { type: "string", enum: ["ok", "warn", "critical"] },
          findings: {
            type: "array",
            items: {
              type: "object",
              properties: {
                kind: {
                  type: "string",
                  enum: [
                    "missing_citation",
                    "deterministic_disagreement",
                    "low_extraction_confidence",
                    "sla_breach_risk",
                    "fabricated_requirement_code",
                  ],
                },
                detail: { type: "string" },
                offending_run_id: { type: "string" },
                offending_message_id: { type: "string" },
                offending_requirement_code: { type: "string" },
              },
              required: ["kind", "detail"],
            },
          },
        },
        required: ["case_id", "severity", "findings"],
      },
    },
    {
      name: "pause_case",
      description:
        "Terminal: ask the orchestrator to halt the case mid-flow. Use only when a finding is `critical` (e.g. fabricated requirement_code in an outbound message).",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
    ACKNOWLEDGE_AND_WAIT,
  ],
  terminal_tools: ["emit_findings", "pause_case", "acknowledge_and_wait"],
  budget: { max_turns: 4, max_input_tokens: 40_000 },
});
