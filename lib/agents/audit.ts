// Audit — read-only watchdog (§2.3). Sweeps an open case (or, when invoked
// at portfolio scope, ALL open cases) and flags: citation gaps, SLA breaches,
// extraction-confidence cliffs, deterministic-vs-LLM disagreement. Never edits
// anything; surfaces findings via flag_finding so the Orchestrator can pause.

import { type AgentDefinition, validateAgent } from "./types";

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Audit",
  description:
    "Read-only watchdog. Sweeps open cases for citation gaps, SLA breaches, and primary/deterministic disagreement; flags but never edits.",
  prompt_path: "lib/prompts/audit.md",
  tools: [
    {
      name: "read_recent_runs",
      description: "Read the most recent agent_runs for a case (or for the whole portfolio if case_id omitted).",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 100 },
        },
      },
    },
    {
      name: "read_assessment_and_audit",
      description: "Read the latest compliance_assessment + its audit_review for a case.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "check_citation_coverage",
      description:
        "For a comms_messages row, verify every factual claim traces back to a requirement_code in the case's cited_rules.",
      input_schema: {
        type: "object",
        properties: { message_id: { type: "string" } },
        required: ["message_id"],
      },
    },
    {
      name: "check_sla",
      description:
        "Check whether a case is at risk of breaching its SLA window (target_date − today, against state-specific thresholds).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "flag_finding",
      description:
        "Terminal: write one finding. Severity drives Orchestrator behavior — `critical` pauses the case mid-flow.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          finding_type: {
            type: "string",
            enum: [
              "citation_gap",
              "sla_breach_risk",
              "extraction_low_confidence",
              "primary_deterministic_mismatch",
              "rule_drift",
              "other",
            ],
          },
          severity: { type: "string", enum: ["critical", "warning", "info"] },
          summary: { type: "string" },
          evidence_ref: {
            type: "string",
            description: "Pointer to the row that triggered the finding (e.g. comms_messages:<id>).",
          },
        },
        required: ["case_id", "finding_type", "severity", "summary"],
      },
    },
    {
      name: "silent_pass",
      description: "Terminal: nothing to flag. The sweep completes without writing a finding.",
      input_schema: {
        type: "object",
        properties: {
          scope: { type: "string", description: "case_id, or 'portfolio' for a global sweep." },
        },
        required: ["scope"],
      },
    },
  ],
  terminal_tools: ["flag_finding", "silent_pass"],
  budget: { max_turns: 5, max_input_tokens: 40_000 },
});
