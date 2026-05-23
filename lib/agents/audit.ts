// Audit (Watchdog) — read-only async observer. Monitors every other agent's
// output and flags citation gaps, deterministic vs LLM disagreement, SLA-breach
// risk, and low-confidence extractions. Posts findings back to the orchestrator;
// never blocks a run itself.

import { type AgentDefinition, validateAgent } from "./types";

const FINDING_KINDS = [
  "citation_gap",
  "deterministic_disagreement",
  "low_extraction_confidence",
  "sla_breach_risk",
  "budget_anomaly",
  "drift_event",
] as const;

const SEVERITIES = ["info", "warn", "block"] as const;

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Audit Watchdog",
  description:
    "Read-only watchdog. Async observer that monitors every other agent's output and flags citation gaps, deterministic disagreements, SLA risk, and low-confidence extractions.",
  prompt_path: "lib/prompts/audit.md",
  tools: [
    {
      name: "read_recent_runs",
      description: "Read the last N agent_runs for a case to inspect the dispatch history.",
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
        "Read the most recent owner-facing messages so claims can be cross-checked against cited_rules.",
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
      description: "Read the document extractions for a case (classification, confidence, mismatch_with_pet).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "post_finding",
      description:
        "Terminal: write a finding back to the orchestrator. Severity `block` pauses the case; `warn` annotates; `info` is informational.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          kind: { type: "string", enum: [...FINDING_KINDS] },
          severity: { type: "string", enum: [...SEVERITIES] },
          summary: { type: "string" },
          evidence: {
            type: "array",
            items: { type: "string" },
            description: "agent_run_ids or message_ids that support the finding.",
          },
        },
        required: ["case_id", "kind", "severity", "summary"],
      },
    },
    {
      name: "all_clear",
      description: "Terminal: nothing to flag. Yields without posting a finding.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          checked: {
            type: "array",
            items: { type: "string" },
            description: "Categories actually checked during this pass (for transparency).",
          },
        },
        required: ["case_id"],
      },
    },
  ],
  terminal_tools: ["post_finding", "all_clear"],
  budget: { max_turns: 4, max_input_tokens: 30_000 },
});
