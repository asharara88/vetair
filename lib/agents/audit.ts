// Audit — read-only watchdog (AGENT.md §2.3). Runs async over the agent_runs
// table and flags four classes of issue back to the orchestrator:
//   - citation coverage < 100% on customer-facing claims
//   - deterministic-vs-LLM disagreement on a factual matter
//   - SLA breach risk relative to target_date / earliest_legal_departure
//   - document extraction confidence below 0.95
// The audit agent never writes case state — it only emits flags. The
// orchestrator decides whether a flag pauses the case or merely logs.

import { type AgentDefinition, validateAgent, READ_CASE_TOOL } from "./types";

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Audit Watchdog",
  description:
    "Read-only watchdog. Polices citation coverage, deterministic-vs-LLM disagreement, SLA breach risk, and low document confidence.",
  prompt_path: "lib/prompts/audit.md",
  tools: [
    READ_CASE_TOOL,
    {
      name: "read_recent_assessments",
      description: "Read the last N compliance_assessments rows for a case, with cited_rules and summary.",
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
      name: "read_recent_runs",
      description: "Read the last N agent_runs for a case, with terminal_tool, model, cost, and turn_count.",
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
      description: "Read the documents linked to a case (with extraction_confidence and verified flag).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_outbound_messages",
      description: "Read the outbound owner-facing messages on a case, with the cited_rules each was grounded in.",
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
      name: "flag_citation_gap",
      description:
        "Terminal-add: a customer-facing claim is not grounded in any requirement_code. Include the message id and the unsupported clause.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          message_id: { type: "string" },
          unsupported_clause: { type: "string" },
          severity: { type: "string", enum: ["critical", "high", "medium"] },
        },
        required: ["case_id", "message_id", "unsupported_clause", "severity"],
      },
    },
    {
      name: "flag_disagreement",
      description:
        "Terminal-add: a requirement_code's LLM verdict disagrees with the deterministic evaluator. Per §5.3, deterministic wins on facts.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          requirement_code: { type: "string" },
          llm_verdict: { type: "string", enum: ["approved", "blocked", "pending"] },
          deterministic_verdict: { type: "string", enum: ["satisfied", "pending", "blocked", "not_applicable"] },
        },
        required: ["case_id", "requirement_code", "llm_verdict", "deterministic_verdict"],
      },
    },
    {
      name: "flag_sla_risk",
      description:
        "Terminal-add: the case stage is not converging fast enough to clear target_date. Include the stage and the projected slip.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          stage: { type: "string", enum: ["intake", "assessment", "documentation", "vet_procedures", "booking"] },
          days_to_target: { type: "integer" },
          projected_slip_days: { type: "integer" },
        },
        required: ["case_id", "stage", "projected_slip_days"],
      },
    },
    {
      name: "flag_low_confidence",
      description:
        "Terminal-add: a document's extraction_confidence is below 0.95. Document team should re-extract or the owner should re-upload.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          document_id: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["case_id", "document_id", "confidence"],
      },
    },
    {
      name: "clear_audit",
      description: "Terminal: no issues detected on this case at this time. Logs a clean sweep with no findings.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          summary: { type: "string", description: "One-line summary of what was checked." },
        },
        required: ["case_id", "summary"],
      },
    },
  ],
  // flag_* tools may be called multiple times before a terminal `clear_audit`
  // OR the loop ends with at least one flag. We treat any flag OR clear_audit
  // as a valid run terminator; clear_audit is the only "all green" exit.
  terminal_tools: [
    "flag_citation_gap",
    "flag_disagreement",
    "flag_sla_risk",
    "flag_low_confidence",
    "clear_audit",
  ],
  budget: { max_turns: 5, max_input_tokens: 40_000 },
});
