// Audit — the read-only watchdog described in AGENT.md §2.3.
// Runs async, monitors every other agent's output, flags:
//   - Citation coverage <100% on customer-facing claims
//   - Deterministic vs LLM disagreement on factual matters
//   - SLA breach risk (turn count, latency, queue depth)
//   - Document extraction confidence <0.95
// Posts findings back to the orchestrator, which can pause the case mid-flow.
//
// Distinct from the Auditor (compliance.ts adversarial reviewer) — that voice
// is in the 3-voice spine; this one watches the *whole* loop.

import { type AgentDefinition, validateAgent } from "./types";

const FINDING_SEVERITY = ["info", "warn", "critical"] as const;

const FINDING_CODES = [
  "citation_gap",
  "deterministic_disagreement",
  "low_extraction_confidence",
  "sla_breach_risk",
  "budget_warning",
  "missing_handoff",
  "consensus_timeout",
] as const;

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Watchdog",
  description:
    "Read-only watchdog. Flags citation gaps, deterministic-vs-LLM disagreement, low-confidence extractions, and SLA-breach risk.",
  prompt_path: "lib/prompts/audit.md",
  tools: [
    {
      name: "read_recent_assessment",
      description: "Read the most recent compliance assessment for a case.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_recent_runs",
      description:
        "Read the last N agent_runs for a case. Use this to spot SLA risk (latency, turn count) and missing handoffs.",
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
      name: "read_documents",
      description:
        "Read all documents linked to a case. Flag any extraction with confidence < 0.95.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_consensus_round",
      description:
        "Read a specific consensus round (3-voice compliance or timeline-feasibility). Use to detect timeouts or unresolved dissent.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          topic: { type: "string" },
        },
        required: ["case_id", "topic"],
      },
    },
    {
      name: "emit_findings",
      description:
        "Terminal: write the watchdog findings. Each finding cites a code + severity. The orchestrator decides whether to pause based on severity.",
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
                code: { type: "string", enum: [...FINDING_CODES] },
                severity: { type: "string", enum: [...FINDING_SEVERITY] },
                detail: { type: "string" },
                related_run_id: { type: "string" },
              },
              required: ["code", "severity", "detail"],
            },
          },
        },
        required: ["case_id", "findings"],
      },
    },
    {
      name: "pause_case",
      description:
        "Terminal: pause the case mid-flow. Use only when a finding's severity is `critical` and the orchestrator must stop dispatch until a human reviews.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
    {
      name: "clear",
      description:
        "Terminal: nothing to flag this turn. Cheaper than emitting an empty findings array.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: ["emit_findings", "pause_case", "clear"],
  budget: { max_turns: 4, max_input_tokens: 40_000 },
});

export const AUDIT_FINDING_CODES = FINDING_CODES;
export const AUDIT_FINDING_SEVERITY = FINDING_SEVERITY;
