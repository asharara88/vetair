// Audit — read-only watchdog. Runs async over every other agent's output and
// flags citation gaps, deterministic disagreements, SLA risk, low-confidence
// extractions. Posts findings back to the Orchestrator (which may pause the case).

import { type AgentDefinition, validateAgent } from "./types";

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Audit Watchdog",
  description:
    "Read-only watchdog. Monitors every agent's output for citation gaps, deterministic vs LLM disagreement, SLA breach risk, and document extraction confidence < 0.95. Posts findings to the Orchestrator.",
  prompt_path: "lib/prompts/audit.md",
  tools: [
    {
      name: "read_case_runs",
      description: "Read agent_runs + agent_turns for a case (read-only window over the recent timeline).",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          since_iso: { type: "string", description: "ISO-8601 lower bound (defaults to last hour)." },
        },
        required: ["case_id"],
      },
    },
    {
      name: "read_assessments",
      description: "Read the most recent compliance assessment + auditor review pair for a case.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_documents",
      description: "Read uploaded documents with extraction_confidence so low-confidence rows can be surfaced.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "compare_with_deterministic",
      description: "Run the deterministic engine over a single requirement_code and diff it against the most recent LLM verdict for the same code.",
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
      name: "raise_finding",
      description: "Append a non-blocking finding to audit_findings. Use for warnings the Orchestrator should see but that do not pause the case.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          severity: { type: "string", enum: ["info", "warn", "high"] },
          category: {
            type: "string",
            enum: [
              "citation_gap",
              "deterministic_disagreement",
              "low_confidence_extraction",
              "sla_risk",
              "budget_risk",
              "other",
            ],
          },
          summary: { type: "string" },
          evidence: {
            type: "object",
            description: "Structured evidence (run_id, requirement_code, document_id, etc).",
          },
        },
        required: ["case_id", "severity", "category", "summary"],
      },
    },
    {
      name: "pause_case",
      description: "Terminal: instruct the Orchestrator to pause the case. Use for HIGH-severity findings only (deterministic disagreement on facts, citation gap on a customer-facing statement).",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          findings: {
            type: "array",
            items: { type: "string", description: "audit_findings.id values" },
            minItems: 1,
          },
        },
        required: ["case_id", "reason", "findings"],
      },
    },
    {
      name: "all_clear",
      description: "Terminal: no actionable findings. Closes this audit pass without posting back to the Orchestrator.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          checks_run: { type: "array", items: { type: "string" } },
        },
        required: ["case_id"],
      },
    },
  ],
  terminal_tools: ["pause_case", "all_clear"],
  budget: { max_turns: 5, max_input_tokens: 50_000 },
});
