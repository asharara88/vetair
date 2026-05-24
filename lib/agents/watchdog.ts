// Watchdog — read-only auditor of every other agent's output.
// Flags citation drift, voice disagreement, low-confidence extractions, SLA risk.
// Distinct from the Compliance `auditor`, which is the adversarial second voice
// in the three-voice spine. The Watchdog never dispatches and never speaks to
// the owner; it only emits findings the orchestrator may pause a case on.

import { type AgentDefinition, validateAgent } from "./types";

const FINDING_KINDS = [
  "citation_drift",
  "voice_disagreement",
  "low_confidence_extraction",
  "sla_risk",
] as const;

const SEVERITIES = ["info", "warning", "critical"] as const;

export const WATCHDOG: AgentDefinition = validateAgent({
  name: "watchdog",
  type: "watchdog",
  model: "claude-haiku-4-5",
  user_facing_label: "Watchdog",
  description:
    "Read-only auditor. Monitors every agent's output for citation drift, voice disagreement, low-confidence extractions, and SLA risk. Flags only — never fixes.",
  prompt_path: "lib/prompts/watchdog.md",
  tools: [
    {
      name: "check_citation_coverage",
      description:
        "Return the citation coverage % for a case's customer-facing claims and any uncited claims found.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "check_voice_disagreement",
      description:
        "Return any disagreements between the deterministic engine, primary compliance, and auditor on this case.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "check_extraction_confidence",
      description:
        "Return documents with extraction_confidence below the given threshold (default 0.95).",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          threshold: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["case_id"],
      },
    },
    {
      name: "check_sla_risk",
      description:
        "Return hours-to-SLA-breach and the agent the case is currently blocked on.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_recent_runs",
      description: "Read the last N agent_runs for the case under audit.",
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
      name: "emit_findings",
      description:
        "Terminal: post findings to the orchestrator. Severity drives whether the orchestrator pauses the case.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          severity: { type: "string", enum: [...SEVERITIES] },
          findings: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                kind: { type: "string", enum: [...FINDING_KINDS] },
                severity: { type: "string", enum: [...SEVERITIES] },
                evidence_run_ids: {
                  type: "array",
                  items: { type: "string" },
                },
                note: { type: "string" },
              },
              required: ["kind", "severity", "note"],
            },
          },
        },
        required: ["case_id", "severity", "findings"],
      },
    },
    {
      name: "acknowledge_clean",
      description:
        "Terminal: every check passed. `checks_run[]` enumerates the checks executed so the orchestrator has a heartbeat record.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          checks_run: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
          },
        },
        required: ["case_id", "checks_run"],
      },
    },
  ],
  terminal_tools: ["emit_findings", "acknowledge_clean"],
  budget: { max_turns: 6, max_input_tokens: 50_000 },
});
