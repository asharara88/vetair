// Audit — async read-only watchdog. Enforces citation coverage,
// determinism-disagreement, low-confidence evidence, and SLA breaches.
// Never messages owners; never votes on compliance. Flags or pauses.

import { type AgentDefinition, validateAgent } from "./types";

const SEVERITIES = ["low", "medium", "high", "critical"] as const;
const FINDING_KINDS = [
  "citation_gap",
  "determinism_disagreement",
  "low_confidence_evidence",
  "sla_breach",
  "uncited_claim",
] as const;

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Audit Watchdog",
  description:
    "Async read-only watchdog. Enforces 100% citation coverage, flags determinism-disagreement, low-confidence evidence, and SLA breaches. Pauses cases on critical findings.",
  prompt_path: "lib/prompts/audit.md",
  tools: [
    {
      name: "read_recent_runs",
      description: "Read the last N agent_runs for a case.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 100 },
        },
        required: ["case_id"],
      },
    },
    {
      name: "read_assessments",
      description: "Read all compliance assessments + auditor reviews for a case.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_comms_thread",
      description: "Read the last N comms_messages for a case, both directions.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 100 },
        },
        required: ["case_id"],
      },
    },
    {
      name: "read_deterministic",
      description: "Read deterministic evaluations for the case (per requirement_code).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "flag_finding",
      description:
        "Terminal: record a finding. Must reference at least one agent_run id as evidence.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          severity: { type: "string", enum: [...SEVERITIES] },
          kind: { type: "string", enum: [...FINDING_KINDS] },
          summary: { type: "string" },
          evidence_run_ids: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
          },
        },
        required: ["case_id", "severity", "kind", "summary", "evidence_run_ids"],
      },
    },
    {
      name: "pause_case",
      description:
        "Terminal: pause the case immediately. Use for `critical` findings (determinism_disagreement, severe SLA breach).",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          evidence_run_ids: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
          },
        },
        required: ["case_id", "reason", "evidence_run_ids"],
      },
    },
    {
      name: "clear_audit",
      description:
        "Terminal: all checks passed. Records the audit pass with the list of checks that ran clean.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          checks_passed: {
            type: "array",
            items: { type: "string", enum: [...FINDING_KINDS] },
            minItems: 1,
          },
        },
        required: ["case_id", "checks_passed"],
      },
    },
  ],
  terminal_tools: ["flag_finding", "pause_case", "clear_audit"],
  budget: { max_turns: 4, max_input_tokens: 40_000 },
});
