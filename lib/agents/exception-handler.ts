// Exception Handler — remediation router. Fired by status_watchdog or any
// agent that hits an unrecoverable condition. Wraps the
// supabase/functions/exception-handler-agent edge function as a registered
// agent so the orchestrator can route to it.

import { type AgentDefinition, validateAgent } from "./types";

export const EXCEPTION_HANDLER: AgentDefinition = validateAgent({
  name: "exception_handler",
  type: "exception_handler",
  model: "claude-sonnet-4-6",
  user_facing_label: "Exception Handler",
  description:
    "Remediation router. Given a case-level problem, reads case state and emits a concrete plan, reroutes the corridor, re-enqueues the orchestrator, or escalates.",
  prompt_path: "lib/prompts/exception-handler.md",
  tools: [
    {
      name: "read_case_state",
      description: "Read full case state (owner, pet, latest assessment, latest audit, recent runs + messages). Call first.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "emit_remediation_plan",
      description:
        "Terminal: a concrete fix exists. Records the plan and notifies the operator. Steps must be acts a human can do today.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          plan: { type: "string" },
          steps: { type: "array", items: { type: "string" } },
          requires_customer_action: { type: "boolean" },
        },
        required: ["case_id", "plan", "steps"],
      },
    },
    {
      name: "reroute_corridor",
      description: "Terminal: the issue is a blocked route/cargo path. Propose an alternate routing.",
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
      description: "Terminal: the case just needs the orchestrator to re-evaluate (e.g. new info arrived). Re-enqueues it.",
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
      description: "Terminal: no automated remediation; a human must intervene.",
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
  budget: { max_turns: 4, max_input_tokens: 30_000 },
});
