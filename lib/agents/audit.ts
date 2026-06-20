// Audit (watchdog) — read-only async monitor.
// Watches every other agent's output and flags:
//   - citation coverage <100%
//   - deterministic vs LLM disagreement on facts
//   - SLA breach risk
//   - document extraction confidence <0.95
// See AGENT.md §2.3.

import { type AgentDefinition, validateAgent } from "./types";
import { caseIdInputSchema } from "./tools";

const FINDING_KIND = [
  "citation_gap",
  "deterministic_disagreement",
  "sla_risk",
  "low_extraction_confidence",
  "missing_evidence",
  "policy_drift",
] as const;

const SEVERITY = ["info", "warning", "critical"] as const;

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Audit Watchdog",
  description:
    "Read-only watchdog. Monitors every agent's output for citation gaps, deterministic disagreement, SLA risk, and low document confidence. Cannot dispatch — only flag.",
  prompt_path: "lib/prompts/audit.md",
  tools: [
    {
      name: "read_recent_runs",
      description: "Read the last N agent_runs for a case to inspect outputs.",
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
        "Read the most recent compliance assessment (verdict, summary, cited_rules, requirements_missing).",
      input_schema: caseIdInputSchema(),
    },
    {
      name: "read_documents",
      description: "Read all documents linked to a case (with extraction_confidence).",
      input_schema: caseIdInputSchema(),
    },
    {
      name: "read_consensus_rounds",
      description:
        "Read consensus_rounds for the case to inspect three-voice agreement and any unresolved disagreements.",
      input_schema: caseIdInputSchema(),
    },
    {
      name: "read_country_rules",
      description: "Read the country_rules table filtered by corridor + species.",
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
      name: "flag_finding",
      description:
        "Terminal: persist a watchdog finding. Severity `critical` requests Orchestrator pause the case.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          kind: { type: "string", enum: [...FINDING_KIND] },
          severity: { type: "string", enum: [...SEVERITY] },
          summary: { type: "string" },
          evidence: {
            type: "array",
            items: { type: "string" },
            description:
              "Pointers to supporting rows (e.g. agent_run id, document id, requirement_code).",
          },
          requested_action: {
            type: "string",
            enum: ["pause_case", "rerun_compliance", "request_document", "none"],
          },
        },
        required: ["case_id", "kind", "severity", "summary"],
      },
    },
    {
      name: "clear_audit",
      description:
        "Terminal: no findings on this pass. Records the audit as clean so the dashboard reflects fresh coverage.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          checks_run: {
            type: "array",
            items: { type: "string", enum: [...FINDING_KIND] },
            description: "Which check categories were verified clean.",
          },
        },
        required: ["case_id", "checks_run"],
      },
    },
  ],
  terminal_tools: ["flag_finding", "clear_audit"],
  budget: { max_turns: 4, max_input_tokens: 40_000 },
});
