// Audit — read-only watchdog. Runs async after every agent terminal and
// flags citation gaps, deterministic-vs-LLM disagreement, SLA-risk timelines,
// and low-confidence document extractions. Reports to orchestrator; never
// mutates case state itself.

import { type AgentDefinition, validateAgent } from "./types";

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Audit Watchdog",
  description:
    "Read-only watchdog. Sweeps recent agent runs for citation gaps, deterministic-vs-LLM disagreement, SLA risk, and low-confidence extractions. Reports findings to the orchestrator.",
  prompt_path: "lib/prompts/audit.md",
  tools: [
    {
      name: "read_recent_runs",
      description: "Read the last N agent_runs across a case, including terminal_tool and confidence.",
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
      name: "read_assessment",
      description: "Read the most recent compliance assessment for the case.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_outbound_messages",
      description: "Read the last N outbound comms messages with their `cited_rules` arrays.",
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
      name: "read_documents",
      description: "Read documents on the case with their `extraction_confidence`.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "report_findings",
      description:
        "Terminal: write findings to `audit_reports`. Severity drives orchestrator response: `critical` pauses the case, `warn` is logged, `info` is recorded silently.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          findings: {
            type: "array",
            items: {
              type: "object",
              properties: {
                kind: {
                  type: "string",
                  enum: [
                    "citation_gap",
                    "deterministic_disagreement",
                    "sla_risk",
                    "low_extraction_confidence",
                    "missing_handoff",
                  ],
                },
                severity: { type: "string", enum: ["critical", "warn", "info"] },
                detail: { type: "string" },
                evidence_ref: {
                  type: "string",
                  description: "agent_runs.id / comms_messages.id / documents.id this finding points at.",
                },
              },
              required: ["kind", "severity", "detail"],
            },
          },
        },
        required: ["case_id", "findings"],
      },
    },
    {
      name: "acknowledge_clean",
      description: "Terminal: nothing to report on this sweep. Records the green run for the audit trail.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
  ],
  terminal_tools: ["report_findings", "acknowledge_clean"],
  budget: { max_turns: 4, max_input_tokens: 40_000 },
});
