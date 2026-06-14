// Exception Handler — computes a remediation path for a case-level problem.
// Fired on signal from status_watchdog (or any agent that hits an exception).
// Reads case state, picks the least-disruptive fix, and routes via one terminal:
//   emit_remediation_plan       → operator-visible plan + steps
//   reroute_corridor            → blocked route; propose alternate
//   request_orchestrator_cycle  → re-enqueue; new info arrived
//   escalate_to_human           → no safe automated path
//   fail_exception              → could not compute remediation; escalates
//
// The edge implementation lives at supabase/functions/exception-handler-agent/.

import { type AgentDefinition, validateAgent } from "./types";

export const EXCEPTION_HANDLER: AgentDefinition = validateAgent({
  name: "exception_handler",
  type: "exception_handler",
  model: "claude-sonnet-4-6",
  user_facing_label: "Exception Handler",
  description:
    "On signal from another agent, reads case state and computes a remediation path. Routes to operator-visible plan, route change, orchestrator re-cycle, or human escalation.",
  prompt_path: "lib/prompts/exception_handler.md",
  tools: [
    {
      name: "read_case_state",
      description:
        "Read the case row plus owner, pet, latest assessment, latest audit, recent agent_runs and agent_messages. Call this first.",
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
        "Terminal: the issue is a blocked route or cargo path. Propose an alternate routing.",
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
        "Terminal: the case just needs the orchestrator to re-evaluate (e.g. new info arrived). Re-enqueue.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
    {
      name: "escalate_to_human",
      description:
        "Terminal: no safe automated remediation. Money, legal liability, or animal welfare at stake.",
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
        "Terminal: could not compute a remediation. Logs and escalates.",
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
  budget: { max_turns: 4, max_input_tokens: 60_000 },
});
