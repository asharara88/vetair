// Audit — read-only watchdog. Runs asynchronously over every other agent's
// output, flags citation gaps, deterministic-vs-LLM disagreement, SLA risk,
// and low-confidence document extractions. Cannot write to case state; only
// emits findings back to the Orchestrator.

import { type AgentDefinition, validateAgent } from "./types";

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Audit Watchdog",
  description:
    "Read-only watchdog. Flags citation gaps, deterministic-vs-LLM disagreement, SLA breach risk, and low-confidence extractions.",
  prompt_path: "lib/prompts/audit.md",
  tools: [
    {
      name: "read_recent_runs",
      description: "Read the last N agent_runs for a case, including terminal tool + token cost.",
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
      name: "read_assessment",
      description: "Read the most recent compliance assessment (verdict, cited_rules, requirements_missing).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_consensus_round",
      description: "Read a consensus_rounds row by id, including all votes and the resolution.",
      input_schema: {
        type: "object",
        properties: { round_id: { type: "string" } },
        required: ["round_id"],
      },
    },
    {
      name: "read_outbound_messages",
      description: "Read recent customer-facing messages to verify each factual claim carries a citation.",
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
      name: "check_citation_coverage",
      description:
        "Cross-check that every factual claim in `outbound.body` is backed by a requirement_code in `outbound.cited_rules`. Returns coverage ratio and uncited spans.",
      input_schema: {
        type: "object",
        properties: { message_id: { type: "string" } },
        required: ["message_id"],
      },
    },
    {
      name: "flag_finding",
      description:
        "Terminal: post a finding back to Orchestrator. Severity drives whether the case pauses (`critical`), warns (`high`), or is logged (`info`).",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          severity: { type: "string", enum: ["info", "high", "critical"] },
          category: {
            type: "string",
            enum: [
              "citation_gap",
              "deterministic_disagreement",
              "sla_risk",
              "low_extraction_confidence",
              "budget_warning",
              "other",
            ],
          },
          summary: { type: "string" },
          evidence: {
            type: "array",
            items: { type: "string" },
            description: "agent_run ids, message ids, or consensus_round ids that support the finding.",
          },
        },
        required: ["case_id", "severity", "category", "summary"],
      },
    },
    {
      name: "all_clear",
      description: "Terminal: no findings on this pass. Records the audit run for the trail.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          checked: {
            type: "array",
            items: { type: "string" },
            description: "Short labels for each check that passed.",
          },
        },
        required: ["case_id"],
      },
    },
  ],
  terminal_tools: ["flag_finding", "all_clear"],
  budget: { max_turns: 4, max_input_tokens: 40_000 },
});
