// Exception Handler — computes a remediation path when audit or another
// agent flags a case-level problem. Mirrors the deployed
// `exception-handler-agent` edge function.

import { type AgentDefinition, validateAgent } from "./types";

export const EXCEPTION_HANDLER: AgentDefinition = validateAgent({
  name: "exception_handler",
  type: "exception_handler",
  model: "claude-sonnet-4-6",
  user_facing_label: "Exception Handler",
  description:
    "Computes a remediation path when audit or another agent flags a problem. Re-enqueues the orchestrator, reroutes the corridor, emits a plan for the operator, or escalates.",
  prompt_path: "lib/prompts/exception_handler.md",
  tools: [
    {
      name: "read_case_state",
      description: "Read the full case state snapshot (case row, latest assessment, latest audit, recent runs, recent messages).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "emit_remediation_plan",
      description:
        "Terminal: a concrete fix exists. Records the plan and notifies the operator.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          plan: { type: "string" },
          steps: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            description: "Concrete imperative steps the operator can act on today.",
          },
          requires_customer_action: { type: "boolean" },
        },
        required: ["case_id", "plan", "steps"],
      },
    },
    {
      name: "reroute_corridor",
      description:
        "Terminal: the issue is a blocked route or cargo path. Propose an alternate routing.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          proposed_route: { type: "string" },
        },
        required: ["case_id", "reason", "proposed_route"],
      },
    },
    {
      name: "request_orchestrator_cycle",
      description:
        "Terminal: re-enqueue the case so the orchestrator re-evaluates (e.g. new info arrived).",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
    {
      name: "escalate_to_human",
      description: "Terminal: no automated remediation. A human must intervene.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          blocking_issue: { type: "string" },
        },
        required: ["case_id", "reason", "blocking_issue"],
      },
    },
    {
      name: "fail_exception",
      description: "Terminal: could not compute a remediation. Logs and escalates.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: [
    "emit_remediation_plan",
    "reroute_corridor",
    "request_orchestrator_cycle",
    "escalate_to_human",
    "fail_exception",
  ],
  budget: { max_turns: 4, max_input_tokens: 40_000 },
});
