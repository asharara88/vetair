// Audit — read-only watchdog. Runs async after every reasoning loop; flags
// citation gaps, deterministic-vs-LLM disagreement, low-confidence document
// extractions, and SLA risk. Never writes to the case state — only emits
// findings the orchestrator can act on.

import { type AgentDefinition, validateAgent } from "./types";

const FINDING_KIND = [
  "citation_coverage_gap",
  "deterministic_disagreement",
  "low_extraction_confidence",
  "sla_breach_risk",
  "duplicate_specialist",
  "budget_overrun",
] as const;

const SEVERITY = ["info", "warn", "block"] as const;

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Audit Watchdog",
  description:
    "Read-only watchdog. Flags citation gaps, deterministic-vs-LLM disagreement, low-confidence extractions, and SLA risk. Never writes to case state.",
  prompt_path: "lib/prompts/audit.md",
  tools: [
    {
      name: "read_recent_runs",
      description:
        "Read the last N agent_runs for a case to inspect terminal tools and turn counts.",
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
      name: "read_assessment_with_audit",
      description:
        "Read the most recent compliance assessment for a case alongside the auditor's concur/dissent verdict.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "check_citation_coverage",
      description:
        "Compute citation coverage: percentage of customer-facing claims in comms_messages that trace back to a requirement_code in the matching assessment.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "check_deterministic_alignment",
      description:
        "Compare deterministic engine output against the LLM compliance verdict for every requirement_code on the case. Returns mismatches.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_low_confidence_documents",
      description:
        "Read documents on a case where extraction_confidence < 0.95.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "flag_finding",
      description:
        "Terminal: emit a finding to audit_findings. Posts to the orchestrator queue at severity ≥ warn so the case can pause if needed.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          kind: { type: "string", enum: [...FINDING_KIND] },
          severity: { type: "string", enum: [...SEVERITY] },
          summary: { type: "string" },
          evidence: {
            type: "object",
            description: "Structured payload — agent_run_id, requirement_code, document_id, etc. depending on kind.",
          },
        },
        required: ["case_id", "kind", "severity", "summary", "evidence"],
      },
    },
    {
      name: "all_clear",
      description:
        "Terminal: no findings. Records a clean audit pass on the case.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
  ],
  terminal_tools: ["flag_finding", "all_clear"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
