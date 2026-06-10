// Exception Handler — fired on signal (status_watchdog or any agent that hits
// an exception). Computes a remediation path and routes it.
//
// Mirrors the runtime in supabase/functions/exception-handler-agent — keep tool
// names and terminal set in sync with that edge function.

import { type AgentDefinition, validateAgent } from "./types";

export const EXCEPTION_HANDLER: AgentDefinition = validateAgent({
  name: "exception_handler",
  type: "exception",
  model: "claude-sonnet-4-6",
  user_facing_label: "Exception Handler",
  description:
    "Fired on signal. Reads case state, computes the least-disruptive remediation, and routes — re-cycle the orchestrator, emit a plan, reroute, or escalate.",
  prompt_path: "lib/prompts/exception_handler.md",
  tools: [
    {
      name: "read_case_state",
      description: "Read the full case state — owner, pet, latest assessment, latest audit, recent runs, recent messages. Call first.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "emit_remediation_plan",
      description: "Terminal: a concrete fix exists. Records the plan and notifies the operator.",
      input_schema: {
        type: "object",
        properties: {
          plan: { type: "string" },
          steps: { type: "array", items: { type: "string" }, minItems: 1 },
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
      description: "Terminal: the case just needs the orchestrator to re-evaluate (e.g. new info arrived). Re-enqueues it.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
    {
      name: "escalate_to_human",
      description: "Terminal: no safe automated remediation; a human must intervene.",
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
