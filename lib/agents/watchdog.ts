// Watchdog — read-only async monitor. Flags citation gaps, deterministic
// disagreements, document confidence drops, and SLA breach risk. Does not
// dispatch; only writes findings the Orchestrator can react to.

import { type AgentDefinition, validateAgent } from "./types";
import { READ_ASSESSMENT_TOOL, READ_CASE_TOOL } from "./tools";

const FINDING_KINDS = [
  "citation_gap",
  "deterministic_disagreement",
  "low_confidence_extraction",
  "sla_breach_risk",
  "budget_warning",
  "missing_audit",
] as const;

const SEVERITIES = ["info", "warn", "error"] as const;

export const WATCHDOG: AgentDefinition = validateAgent({
  name: "watchdog",
  type: "watchdog",
  model: "claude-haiku-4-5",
  user_facing_label: "Watchdog",
  description:
    "Read-only async monitor. Flags citation gaps, deterministic disagreements, low extraction confidence, and SLA breach risk.",
  prompt_path: "lib/prompts/watchdog.md",
  tools: [
    READ_CASE_TOOL,
    READ_ASSESSMENT_TOOL,
    {
      name: "read_audit_review",
      description:
        "Read the most recent auditor verdict (concur/dissent) and challenge list for a case.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
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
      name: "read_recent_messages",
      description:
        "Read the last N owner-facing comms_messages on a case to check citation coverage.",
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
      name: "emit_finding",
      description:
        "Terminal: write a watchdog_findings row. Orchestrator listens and may pause the case.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          kind: { type: "string", enum: [...FINDING_KINDS] },
          severity: { type: "string", enum: [...SEVERITIES] },
          detail: { type: "string" },
          cited_rules: {
            type: "array",
            items: { type: "string" },
            description:
              "Requirement codes the finding cites (if any). Empty for SLA / budget findings.",
          },
        },
        required: ["case_id", "kind", "severity", "detail"],
      },
    },
    {
      name: "emit_clean",
      description:
        "Terminal: no anomalies detected. Records the pass so the Orchestrator can advance the case.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          checks_run: { type: "array", items: { type: "string" } },
        },
        required: ["case_id", "checks_run"],
      },
    },
  ],
  terminal_tools: ["emit_finding", "emit_clean"],
  budget: { max_turns: 4, max_input_tokens: 30_000 },
});
