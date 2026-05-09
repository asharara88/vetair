// Audit — read-only watchdog. Streams over agent_runs, comms_messages,
// and consensus_rounds; flags citation gaps, deterministic-vs-LLM splits,
// SLA risk, and low extraction confidence. Never mutates a case directly —
// it posts a finding back to the orchestrator, which decides whether to pause.

import { type AgentDefinition, validateAgent } from "./types";

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Audit",
  description:
    "Read-only watchdog. Flags citation gaps, deterministic-vs-LLM splits, SLA risk, low extraction confidence. Posts findings back to the orchestrator.",
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
      name: "read_recent_comms",
      description: "Read the last N outbound comms_messages for a case (citation coverage check).",
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
      name: "read_consensus_rounds",
      description: "Read consensus rounds for a case to detect deterministic-vs-LLM splits.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_documents",
      description: "Read uploaded documents (and extraction confidence) for a case.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "post_finding",
      description:
        "Terminal: emit a single audit finding for the orchestrator. Severity drives whether the orchestrator pauses (high) or just logs (low).",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          severity: { type: "string", enum: ["info", "low", "medium", "high"] },
          category: {
            type: "string",
            enum: [
              "citation_gap",
              "deterministic_split",
              "low_extraction_confidence",
              "sla_risk",
              "tool_misuse",
              "budget_anomaly",
              "other",
            ],
          },
          summary: { type: "string" },
          subjects: {
            type: "array",
            items: {
              type: "object",
              properties: {
                kind: {
                  type: "string",
                  enum: ["agent_run", "comms_message", "consensus_round", "document", "case"],
                },
                id: { type: "string" },
              },
              required: ["kind", "id"],
            },
            description: "Rows the finding refers to so the orchestrator can drill in.",
          },
          recommended_action: {
            type: "string",
            enum: ["pause_case", "rerun_compliance", "request_document", "escalate_to_human", "none"],
          },
        },
        required: ["case_id", "severity", "category", "summary", "recommended_action"],
      },
    },
    {
      name: "all_clear",
      description: "Terminal: no findings worth surfacing on this pass.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          checked: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "citation_coverage",
                "deterministic_consistency",
                "extraction_confidence",
                "sla_pacing",
                "budget_pacing",
              ],
            },
            description: "Which audit categories were actually inspected on this pass.",
          },
        },
        required: ["case_id", "checked"],
      },
    },
  ],
  terminal_tools: ["post_finding", "all_clear"],
  budget: { max_turns: 4, max_input_tokens: 40_000 },
});
