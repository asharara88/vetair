// Audit — read-only watchdog (see AGENT.md §2.3). Monitors every other agent's
// output and flags:
//   - citation coverage <100% on customer-facing claims
//   - deterministic vs LLM disagreement
//   - SLA breach risk
//   - document extraction confidence <0.95
// Never writes to case or pet rows; only writes to audit_findings and may post
// an agent_messages notification to the orchestrator.
//
// Distinct from the Compliance Auditor (`auditor.ts`), which votes inside the
// 3-voice spine. This one is portfolio-wide and reactive.

import { type AgentDefinition, validateAgent } from "./types";

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Audit",
  description:
    "Read-only portfolio watchdog. Flags citation gaps, deterministic/LLM disagreements, SLA risk, and low-confidence extractions. Never mutates case data.",
  prompt_path: "lib/prompts/audit.md",
  tools: [
    {
      name: "read_recent_assessments",
      description: "Read the last N compliance_assessments for a case, including cited_rules and the primary/auditor votes.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 20 },
        },
        required: ["case_id"],
      },
    },
    {
      name: "read_recent_comms",
      description: "Read the last N outbound comms_messages for a case, including cited_rules attached at send time.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 20 },
        },
        required: ["case_id"],
      },
    },
    {
      name: "read_recent_extractions",
      description: "Read the last N document extractions for a case, including per-field confidence.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 20 },
        },
        required: ["case_id"],
      },
    },
    {
      name: "read_deterministic_log",
      description: "Read the deterministic evaluator log for a case, including which rule_codes the LLM and the TS engine disagreed on.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "emit_finding",
      description:
        "Terminal: write one or more audit findings. Severity scale: info (noted), warn (operator should see), block (orchestrator must pause the case).",
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
                category: {
                  type: "string",
                  enum: [
                    "citation_gap",
                    "deterministic_disagreement",
                    "sla_breach_risk",
                    "low_extraction_confidence",
                    "cross_agent_inconsistency",
                  ],
                },
                severity: { type: "string", enum: ["info", "warn", "block"] },
                evidence: { type: "string" },
                cited_rules: { type: "array", items: { type: "string" } },
              },
              required: ["category", "severity", "evidence"],
            },
          },
        },
        required: ["case_id", "findings"],
      },
    },
    {
      name: "all_clear",
      description: "Terminal: nothing worth flagging. No write occurs.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          scanned: { type: "integer", description: "Number of rows scanned during this sweep." },
        },
        required: ["case_id"],
      },
    },
  ],
  terminal_tools: ["emit_finding", "all_clear"],
  budget: { max_turns: 4, max_input_tokens: 30_000 },
});
