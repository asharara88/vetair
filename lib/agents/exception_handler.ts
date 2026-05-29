// Exception Handler — recovery agent for flagged cases.
// Runtime: supabase/functions/exception-handler-agent. Fired on signal from the
// watchdog (or any agent that hits an exception). Reads full case state, then
// picks the least-disruptive remediation and routes it.

import { type AgentDefinition, validateAgent } from "./types";

export const EXCEPTION_HANDLER: AgentDefinition = validateAgent({
  name: "exception_handler",
  type: "exception",
  model: "claude-sonnet-4-6",
  user_facing_label: "Exception Handler",
  description:
    "Recovery agent for flagged cases. Reads full case state, then computes the least-disruptive remediation: a concrete plan, a corridor reroute, an orchestrator re-evaluation, or human escalation.",
  prompt_path: "lib/prompts/exception_handler.md",
  tools: [
    {
      name: "read_case_state",
      description: "Read full case state (owner, pet, latest assessment + audit, recent runs + messages) before deciding. Call first.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "emit_remediation_plan",
      description: "Terminal: a concrete fix exists. Records the plan and notifies the operator.",
      input_schema: {
        type: "object",
        properties: {
          plan: { type: "string" },
          steps: { type: "array", items: { type: "string" } },
          requires_customer_action: { type: "boolean" },
        },
        required: ["plan", "steps"],
      },
    },
    {
      name: "reroute_corridor",
      description: "Terminal: the issue is a blocked route/cargo path; propose an alternate routing.",
      input_schema: {
        type: "object",
        properties: {
          reason: { type: "string" },
          proposed_route: { type: "string" },
        },
        required: ["reason", "proposed_route"],
      },
    },
    {
      name: "request_orchestrator_cycle",
      description: "Terminal: the case just needs the orchestrator to re-evaluate (e.g. new info arrived). Re-enqueue it.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
    {
      name: "escalate_to_human",
      description: "Terminal: no automated remediation; a human must intervene.",
      input_schema: {
        type: "object",
        properties: {
          reason: { type: "string" },
          blocking_issue: { type: "string" },
        },
        required: ["reason", "blocking_issue"],
      },
    },
    {
      name: "fail_exception",
      description: "Terminal: could not compute a remediation. Logs and escalates.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
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
