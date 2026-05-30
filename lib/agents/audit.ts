// Audit — read-only watchdog (AGENT.md §2.3). Runs after each agent terminal
// and sweeps for: incomplete citation coverage, deterministic vs LLM
// disagreement on facts, document extraction confidence below 0.95, SLA risk.
//
// IMPORTANT: this agent is read-only. It NEVER mutates case state. It either
// records a clean bill of health or files a flag for the orchestrator to act
// on. This separation is what makes it safe to run on every turn.
//
// Not to be confused with `auditor` (the adversarial compliance reviewer that
// participates in the 3-voice consensus). Naming convention:
//   - auditor → in-loop, opinionated, can dissent and block consensus
//   - audit   → out-of-loop, read-only, flags but never blocks

import { type AgentDefinition, validateAgent } from "./types";

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Quality Watchdog",
  description:
    "Read-only watchdog. Sweeps every other agent's output for citation coverage, deterministic-vs-LLM disagreement, and SLA breach risk; flags but never blocks.",
  prompt_path: "lib/prompts/audit.md",
  tools: [
    {
      name: "read_run",
      description: "Read the agent_runs row plus its terminal tool payload that triggered this sweep.",
      input_schema: {
        type: "object",
        properties: { run_id: { type: "string" } },
        required: ["run_id"],
      },
    },
    {
      name: "read_assessment",
      description: "Read the latest compliance_assessments row for the case (verdict, cited_rules, requirements_missing).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_deterministic_evaluations",
      description: "Read requirement_evaluations rows produced by the TS engine for the case. Authoritative on facts.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_outbound_messages",
      description: "Read recent comms_messages with direction='outbound' to verify every factual claim cites a rule.",
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
      name: "read_document_extractions",
      description: "Read extractions linked to the case so confidence < 0.95 can be flagged.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "record_clean",
      description:
        "Terminal: nothing to flag. Writes audit_findings with verdict='clean'. The case proceeds.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          run_id: { type: "string" },
          checks: {
            type: "array",
            items: { type: "string" },
            description: "Which checks were performed (e.g. citation_coverage, det_vs_llm, extraction_confidence, sla_risk).",
          },
        },
        required: ["case_id", "run_id", "checks"],
      },
    },
    {
      name: "flag_finding",
      description:
        "Terminal: at least one quality issue found. Writes audit_findings with verdict='flag' and a structured list of findings. The orchestrator decides whether to pause the case or continue with the flag attached.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          run_id: { type: "string" },
          severity: { type: "string", enum: ["info", "warn", "block"] },
          findings: {
            type: "array",
            items: {
              type: "object",
              properties: {
                category: {
                  type: "string",
                  enum: [
                    "citation_missing",
                    "citation_invalid",
                    "det_vs_llm_disagreement",
                    "low_extraction_confidence",
                    "sla_risk",
                    "policy_violation",
                  ],
                },
                detail: { type: "string" },
                requirement_code: { type: "string" },
                evidence_ref: { type: "string" },
              },
              required: ["category", "detail"],
            },
            minItems: 1,
          },
        },
        required: ["case_id", "run_id", "severity", "findings"],
      },
    },
  ],
  terminal_tools: ["record_clean", "flag_finding"],
  budget: { max_turns: 4, max_input_tokens: 40_000 },
});
