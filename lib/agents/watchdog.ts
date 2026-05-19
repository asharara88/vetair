// Watchdog — read-only async monitor. Fires on every other agent's output.
// Catches: citation coverage <100%, deterministic-vs-LLM disagreement, SLA
// breach risk, document-extraction confidence below threshold. Files a
// finding for the Orchestrator to act on; never writes to the case itself.

import { type AgentDefinition, validateAgent } from "./types";
import { READ_ASSESSMENT_TOOL, READ_CASE_TOOL } from "./shared-tools";

export const WATCHDOG: AgentDefinition = validateAgent({
  name: "watchdog",
  type: "watchdog",
  model: "claude-haiku-4-5",
  user_facing_label: "Watchdog",
  description:
    "Read-only async monitor. Flags citation gaps, deterministic-vs-LLM disagreement, SLA breach risk, and low-confidence document extractions.",
  prompt_path: "lib/prompts/watchdog.md",
  tools: [
    READ_CASE_TOOL,
    READ_ASSESSMENT_TOOL,
    {
      name: "read_recent_runs",
      description:
        "Read the last N agent_runs for a case, including terminal_tool and tool inputs. Used to check what every agent claimed in its terminal call.",
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
        "Read all documents linked to a case with extraction_confidence values.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_deterministic_evaluations",
      description:
        "Read the requirement_evaluations table for a case. Used to compare against the primary compliance verdict.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "file_finding",
      description:
        "Terminal: write a finding to the orchestrator_queue. severity=block pauses the case; severity=warn lets it proceed with a note.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          category: {
            type: "string",
            enum: [
              "citation_gap",
              "deterministic_disagreement",
              "sla_breach_risk",
              "low_confidence_document",
              "invented_rule_code",
              "policy_violation",
            ],
          },
          severity: { type: "string", enum: ["info", "warn", "block"] },
          summary: { type: "string" },
          evidence: {
            type: "object",
            description: "Structured pointer to the offending row: { table, id, field, expected, actual }.",
          },
        },
        required: ["case_id", "category", "severity", "summary"],
      },
    },
    {
      name: "clean_bill",
      description:
        "Terminal: nothing to flag. Reasoning must enumerate the categories you checked.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reasoning: { type: "string" },
        },
        required: ["case_id", "reasoning"],
      },
    },
  ],
  terminal_tools: ["file_finding", "clean_bill"],
  budget: { max_turns: 5, max_input_tokens: 50_000 },
});
