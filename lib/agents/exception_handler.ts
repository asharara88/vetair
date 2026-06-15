// Exception Handler — fired on signal (typically from status_watchdog).
// Computes a remediation path for a case-level problem and routes it.
// Edge function: supabase/functions/exception-handler-agent.

import { type AgentDefinition, validateAgent } from "./types";

export const EXCEPTION_HANDLER: AgentDefinition = validateAgent({
  name: "exception_handler",
  type: "exception_handler",
  model: "claude-sonnet-4-6",
  user_facing_label: "Exception Handler",
  description:
    "Receives an exception signal, reads case state, and picks the least-disruptive remediation: plan, reroute, re-cycle, or escalate.",
  prompt_path: "lib/prompts/exception_handler.md",
  tools: [
    {
      name: "read_case_state",
      description:
        "Read full case state (owner, pet, latest assessment + audit, recent runs + messages). Call first; no terminal may fire before this.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "emit_remediation_plan",
      description:
        "Terminal: a concrete fix exists. Records the plan and notifies the operator.",
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
        "Terminal: route or cargo path is blocked (embargo, cancelled flight, no cargo space). Propose an alternate routing.",
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
        "Terminal: case just needs the orchestrator to re-evaluate (e.g. new info arrived). Re-enqueues it via orchestrator_queue.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
    {
      name: "escalate_to_human",
      description:
        "Terminal: no automated remediation. Money, legal liability, or animal welfare is at stake — hand off.",
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
