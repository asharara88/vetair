// Audit — async, read-only watchdog. Re-reads every other agent's output and
// flags citation-coverage gaps, LLM-vs-deterministic disagreements, low document
// confidence, and SLA-breach risk. Does NOT block dispatch; posts findings
// back to the orchestrator which decides whether to pause.

import { type AgentDefinition, validateAgent } from "./types";

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Audit",
  description:
    "Async read-only watchdog. Flags citation-coverage gaps, LLM/deterministic disagreement, low extraction confidence, and SLA breach risk.",
  prompt_path: "lib/prompts/audit.md",
  tools: [
    {
      name: "read_agent_runs",
      description: "Read the last N agent_runs for a case, including terminal_tool and the tool payload.",
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
      description: "Read the latest compliance assessment (verdict, cited_rules, summary, requirements_missing).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_comms_messages",
      description: "Read the last N outbound owner messages for a case to spot citation gaps.",
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
      description: "Read documents for a case to check extraction_confidence.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "flag_finding",
      description:
        "Terminal: write an audit finding back to the orchestrator queue. Multiple findings → call once per finding; the orchestrator deduplicates.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          severity: { type: "string", enum: ["info", "warn", "block"] },
          category: {
            type: "string",
            enum: [
              "citation_gap",
              "llm_vs_deterministic",
              "low_extraction_confidence",
              "sla_risk",
              "prompt_violation",
            ],
          },
          finding: { type: "string", description: "One sentence — what is wrong, concretely." },
          evidence_run_ids: {
            type: "array",
            items: { type: "string" },
            description: "agent_runs.id rows that back the finding.",
          },
        },
        required: ["case_id", "severity", "category", "finding"],
      },
    },
    {
      name: "all_clear",
      description: "Terminal: no findings worth orchestrator attention. Records a clean sweep.",
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
                "llm_vs_deterministic",
                "extraction_confidence",
                "sla",
                "prompt_compliance",
              ],
            },
            description: "Categories that were actually inspected this sweep.",
          },
        },
        required: ["case_id", "checked"],
      },
    },
  ],
  terminal_tools: ["flag_finding", "all_clear"],
  budget: { max_turns: 4, max_input_tokens: 40_000 },
});
