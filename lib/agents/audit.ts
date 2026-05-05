// Audit — read-only watchdog. Runs async after every other agent's terminal
// tool. Flags citation-coverage misses, deterministic disagreements, low-
// confidence extractions, and SLA breach risk. NEVER mutates case state —
// it posts findings to audit_findings; the orchestrator decides whether to act.

import { type AgentDefinition, validateAgent } from "./types";

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Audit Watchdog",
  description:
    "Read-only watchdog. After every reasoning loop closes, verifies citation coverage, deterministic agreement, document confidence, and SLA pacing. Posts findings; never mutates case state.",
  prompt_path: "lib/prompts/audit.md",
  tools: [
    {
      name: "read_recent_runs",
      description: "Read the last N agent_runs for a case (state, terminal_tool, total_cost, latency_ms).",
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
      description: "Read the most recent compliance assessment (verdict, summary, cited_rules).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_outbound_messages",
      description:
        "Read recent customer-facing messages with their declared cited_rules so coverage can be checked.",
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
      name: "read_extractions",
      description:
        "Read document extraction confidences for the case. Used to flag any extraction <0.95.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_deterministic_disagreements",
      description:
        "Read pairs of (LLM evaluation, deterministic evaluation) that disagree on a requirement_code.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "post_findings",
      description:
        "Terminal: write one or more findings to audit_findings. Severity drives whether the orchestrator pauses the case.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          findings: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                kind: {
                  type: "string",
                  enum: [
                    "citation_gap",
                    "deterministic_disagreement",
                    "low_extraction_confidence",
                    "sla_breach_risk",
                    "budget_pressure",
                    "uncited_outbound",
                  ],
                },
                severity: { type: "string", enum: ["info", "warn", "block"] },
                detail: { type: "string" },
                cited_evidence: {
                  type: "array",
                  items: { type: "string" },
                  description: "Run ids, message ids, requirement codes etc. that ground the finding.",
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
      name: "all_clear",
      description: "Terminal: nothing flagged this pass. Writes a single 'all_clear' row to audit_findings for the audit trail.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
  ],
  terminal_tools: ["post_findings", "all_clear"],
  budget: { max_turns: 4, max_input_tokens: 30_000 },
});
