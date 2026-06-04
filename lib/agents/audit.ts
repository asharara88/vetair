// Audit — read-only watchdog. Runs async, monitors every agent's output for
// citation gaps, deterministic disagreements, low extraction confidence, and
// SLA breach risk. Never mutates case state; posts findings back to the
// orchestrator which decides whether to pause the case.

import { type AgentDefinition, validateAgent } from "./types";

const FINDING_KINDS = [
  "citation_gap",
  "deterministic_disagreement",
  "low_extraction_confidence",
  "sla_breach_risk",
  "budget_burn",
  "hallucinated_rule_code",
] as const;

const SEVERITIES = ["info", "warning", "critical"] as const;

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Audit",
  description:
    "Read-only watchdog. Monitors every agent's output for citation gaps, deterministic disagreements, low extraction confidence, and SLA breach risk.",
  prompt_path: "lib/prompts/audit.md",
  tools: [
    {
      name: "read_recent_runs",
      description:
        "Read the last N agent_runs for a case to inspect dispatch history, terminal tools, and costs.",
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
      description:
        "Read the most recent compliance assessment for a case (verdict, summary, cited_rules, requirements_missing).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_documents",
      description: "Read all documents linked to a case (with extracted_fields + extraction_confidence).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_country_rules",
      description:
        "Read the country_rules entries for a corridor + species so you can verify cited requirement_codes exist.",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string" },
          destination: { type: "string" },
          species: { type: "string" },
        },
        required: ["origin", "destination", "species"],
      },
    },
    {
      name: "run_deterministic",
      description:
        "Run the deterministic TS evaluator for a requirement_code. Use to cross-check the primary compliance verdict.",
      input_schema: {
        type: "object",
        properties: { rule_code: { type: "string" } },
        required: ["rule_code"],
      },
    },
    {
      name: "emit_findings",
      description:
        "Terminal: emit the audit findings. Empty `findings[]` means the case passed the audit cleanly.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          findings: {
            type: "array",
            items: {
              type: "object",
              properties: {
                kind: { type: "string", enum: [...FINDING_KINDS] },
                severity: { type: "string", enum: [...SEVERITIES] },
                detail: { type: "string" },
                offending_agent: { type: "string" },
                requirement_code: { type: "string" },
              },
              required: ["kind", "severity", "detail"],
            },
          },
          recommend_pause: {
            type: "boolean",
            description:
              "If true, orchestrator should pause the case before the next dispatch. Use sparingly — reserved for critical findings.",
          },
        },
        required: ["case_id", "findings"],
      },
    },
  ],
  terminal_tools: ["emit_findings"],
  budget: { max_turns: 4, max_input_tokens: 40_000 },
});
