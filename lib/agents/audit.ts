// Audit — async, read-only watchdog over per-agent output.
// Distinct from the Compliance Auditor (which is an inline adversarial voice
// inside the three-voice spine). This agent runs after agent_runs land and
// posts findings back to the orchestrator without ever mutating case state.

import { type AgentDefinition, validateAgent } from "./types";

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Audit",
  description:
    "Async watchdog. Read-only sweep across each agent's output checking citation coverage, deterministic-vs-LLM disagreement, SLA risk, and low-confidence extractions.",
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
      name: "read_assessment",
      description: "Read the most recent compliance assessment for a case.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_documents",
      description: "Read all documents linked to a case (with extraction_confidence).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_deterministic_evaluations",
      description: "Read the deterministic evaluator results for a case.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "post_finding",
      description:
        "Terminal: post a single audit finding back to the orchestrator. `severity=block` pauses the case; `warn` is informational only.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          severity: { type: "string", enum: ["block", "warn"] },
          category: {
            type: "string",
            enum: [
              "citation_coverage",
              "deterministic_disagreement",
              "sla_breach_risk",
              "low_extraction_confidence",
            ],
          },
          finding: { type: "string" },
          cited_rules: { type: "array", items: { type: "string" } },
        },
        required: ["case_id", "severity", "category", "finding"],
      },
    },
    {
      name: "audit_clean",
      description: "Terminal: no findings — every check passed. Records the all-clear for the case timeline.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          checks_passed: { type: "array", items: { type: "string" } },
        },
        required: ["case_id", "checks_passed"],
      },
    },
  ],
  terminal_tools: ["post_finding", "audit_clean"],
  budget: { max_turns: 4, max_input_tokens: 40_000 },
});
