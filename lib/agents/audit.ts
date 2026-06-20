// Audit — async read-only watchdog. Inspects every other agent's output for
// citation coverage (must be 100%), deterministic vs LLM disagreement,
// SLA breach risk, and document extraction confidence below threshold.
// Posts findings back to the orchestrator; never mutates case state.

import { type AgentDefinition, validateAgent } from "./types";
import { CASE_ID_INPUT } from "./shared-tools";

const FINDING_KINDS = [
  "missing_citation",
  "deterministic_disagreement",
  "low_extraction_confidence",
  "sla_breach_risk",
  "uncited_factual_claim",
  "consensus_split",
] as const;

const FINDING_SEVERITY = ["info", "warning", "critical"] as const;

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Audit Watchdog",
  description:
    "Read-only watchdog. Enforces 100% citation coverage, flags deterministic vs LLM disagreement, raises SLA breach risk and low-confidence extractions.",
  prompt_path: "lib/prompts/audit.md",
  tools: [
    {
      name: "read_recent_runs",
      description: "Read the last N agent_runs for a case.",
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
      description: "Read the most recent compliance assessment for a case (verdict, summary, cited_rules).",
      input_schema: CASE_ID_INPUT,
    },
    {
      name: "read_consensus_round",
      description: "Read the most recent consensus round (votes, participants, resolution) for a case.",
      input_schema: CASE_ID_INPUT,
    },
    {
      name: "read_documents",
      description: "Read all documents linked to a case, including extraction_confidence.",
      input_schema: CASE_ID_INPUT,
    },
    {
      name: "read_outbound_messages",
      description:
        "Read recent outbound comms_messages to scan for uncited factual claims.",
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
      name: "flag_finding",
      description:
        "Non-terminal: record an audit finding. May be called multiple times before close_audit.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          severity: { type: "string", enum: [...FINDING_SEVERITY] },
          kind: { type: "string", enum: [...FINDING_KINDS] },
          detail: { type: "string" },
          related_run_id: { type: "string" },
          related_message_id: { type: "string" },
        },
        required: ["case_id", "severity", "kind", "detail"],
      },
    },
    {
      name: "close_audit",
      description:
        "Terminal: finish the audit run. `summary` must enumerate the kinds of checks performed, even if no findings were raised.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          summary: { type: "string" },
          findings_count: { type: "integer", minimum: 0 },
        },
        required: ["case_id", "summary", "findings_count"],
      },
    },
  ],
  terminal_tools: ["close_audit"],
  budget: { max_turns: 8, max_input_tokens: 40_000 },
});
