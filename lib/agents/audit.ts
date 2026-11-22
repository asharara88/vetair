// Audit Watchdog — read-only cross-check that runs async over every agent run.
// Flags citation-coverage gaps, deterministic/LLM disagreement, SLA risk, and
// low-confidence document extractions. Writes findings into `audit_reviews`
// and (for blockers) enqueues a task_queue row so the Orchestrator can pause.

import { type AgentDefinition, type AgentTool, validateAgent } from "./types";

const FINDING_CATEGORIES = [
  "citation_coverage",
  "deterministic_disagreement",
  "sla_risk",
  "low_extraction_confidence",
  "budget_pressure",
  "orphaned_consensus_round",
] as const;

const READ_TOOLS: AgentTool[] = [
  {
    name: "read_assessment",
    description:
      "Read the latest compliance assessment for a case (verdict, summary, cited_rules, requirements_missing).",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  },
  {
    name: "read_citations",
    description:
      "Return every customer-facing claim emitted on the case (outbound comms + assessment summary sentences) with the citations it claims. Used to verify 100% coverage.",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  },
  {
    name: "read_deterministic_verdicts",
    description:
      "Return the deterministic engine's evaluations for the case (one row per requirement_code). Authoritative on facts.",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  },
  {
    name: "read_recent_runs",
    description:
      "Return the last N agent_runs for a case so you can scan for stuck runs, budget pressure, and dispatch gaps.",
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
      "Read all documents linked to a case with their `extraction_confidence`. Low-confidence documents backing a cited claim are a finding.",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  },
];

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Audit Watchdog",
  description:
    "Async watchdog over every agent run. Enforces 100% citation coverage, flags deterministic/LLM disagreement, SLA breach risk, and low document-extraction confidence. Read-only.",
  prompt_path: "lib/prompts/audit.md",
  tools: [
    ...READ_TOOLS,
    {
      name: "flag_finding",
      description:
        "Terminal: write one or more findings into `audit_reviews`. A finding with severity `blocker` auto-enqueues an orchestrator_queue row so the case is paused until the Orchestrator reacts.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          findings: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                category: { type: "string", enum: [...FINDING_CATEGORIES] },
                severity: { type: "string", enum: ["info", "warn", "blocker"] },
                details: { type: "string" },
                offending_run_id: { type: "string" },
                offending_requirement_code: { type: "string" },
                offending_document_id: { type: "string" },
              },
              required: ["category", "severity", "details"],
            },
          },
        },
        required: ["case_id", "findings"],
      },
    },
    {
      name: "clear_case",
      description: "Terminal: nothing to flag on this pass. Records a clean audit row for the trail.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          scanned_run_ids: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["case_id"],
      },
    },
  ],
  terminal_tools: ["flag_finding", "clear_case"],
  budget: { max_turns: 5, max_input_tokens: 40_000 },
});
