// Exception Handler — invoked on signal (watchdog, or any agent that hits an
// exception). Computes a remediation path and routes it. Mirrors
// supabase/functions/exception-handler-agent.

import { type AgentDefinition, validateAgent } from "./types";

export const EXCEPTION_HANDLER: AgentDefinition = validateAgent({
  name: "exception_handler",
  type: "exception_handler",
  model: "claude-sonnet-4-6",
  user_facing_label: "Exception Handler",
  description:
    "Called when an agent or the watchdog surfaces an exception. Computes the least-disruptive remediation path and routes it.",
  prompt_path: "lib/prompts/exception_handler.md",
  tools: [
    {
      name: "read_case_state",
      description:
        "Read full case state before deciding. Returns owner, pet, latest assessment + audit, recent agent_runs, recent agent_messages.",
      input_schema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "emit_remediation_plan",
      description:
        "Terminal: a concrete fix exists. Records the plan steps and notifies the operator. Use when the next action is a well-defined manual step (book, call, file).",
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
      description:
        "Terminal: the issue is a blocked route/cargo path (embargo, cancelled flight, no cargo space). Proposes an alternate routing to the operator.",
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
      description:
        "Terminal: the case just needs the orchestrator to re-evaluate (e.g. new info arrived). Re-enqueues it.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
    {
      name: "escalate_to_human",
      description:
        "Terminal: no automated remediation is safe (money, legal liability, or animal welfare at stake). Marks the case escalated_to_human and notifies the operator.",
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
      description:
        "Terminal: could not compute a remediation. Logs the failure and routes the case to the human queue.",
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
