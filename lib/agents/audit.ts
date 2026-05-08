// Audit — read-only watchdog. Runs async behind every other agent's output.
// Flags: citation coverage gaps, deterministic vs LLM disagreement, SLA risk,
// low-confidence document extractions. Posts findings to the orchestrator
// which can pause a case mid-flow.

import { type AgentDefinition, validateAgent } from "./types";
import { ACKNOWLEDGE_AND_WAIT_TOOL } from "./shared-tools";

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Audit",
  description:
    "Read-only watchdog. Monitors every other agent's output for citation gaps, voice disagreement, SLA risk, and low-confidence extractions. Posts findings the orchestrator can act on.",
  prompt_path: "lib/prompts/audit.md",
  tools: [
    {
      name: "read_recent_runs",
      description: "Read the last N agent_runs for a case to inspect dispatch history.",
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
      name: "read_audit_review",
      description: "Read the auditor's most recent concur/dissent on a case.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_recent_comms",
      description: "Read the last N owner-facing messages so you can audit citation coverage on customer claims.",
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
      name: "read_documents",
      description:
        "Read all documents on the case with extraction confidence — used to flag low-confidence extractions that other agents are about to act on.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "check_citation_coverage",
      description:
        "Compute the percentage of factual claims in recent customer-facing messages that are backed by a cited requirement_code.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "flag_concern",
      description:
        "Terminal: write an audit finding. severity=`high` pauses the case at the next orchestrator turn; severity=`medium` is logged and surfaced; severity=`low` is logged.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          category: {
            type: "string",
            enum: [
              "citation_gap",
              "voice_disagreement",
              "low_confidence_extraction",
              "sla_breach_risk",
              "policy_violation",
              "other",
            ],
          },
          summary: { type: "string" },
          evidence_run_ids: {
            type: "array",
            items: { type: "string" },
            description: "agent_runs.id rows that motivated this finding.",
          },
        },
        required: ["case_id", "severity", "category", "summary"],
      },
    },
    {
      name: "request_pause",
      description:
        "Terminal: ask the orchestrator to pause the case. Reserved for high-severity findings the orchestrator must act on before any further dispatch.",
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
      description: "Terminal: nothing to flag. Case is healthy. Use sparingly — the watchdog earns its keep by finding things.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: ["flag_concern", "request_pause", "clear", "acknowledge_and_wait"],
  budget: { max_turns: 5, max_input_tokens: 40_000 },
});
