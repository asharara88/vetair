// Exception Handler — fired on signal (status_watchdog, or any agent hitting
// an exception). Computes a remediation path and routes the case.
//
// Deployed as supabase/functions/exception-handler-agent — this TS definition
// is the authoritative tool manifest + budget for the registry UI.

import { type AgentDefinition, validateAgent } from "./types";

export const EXCEPTION_HANDLER: AgentDefinition = validateAgent({
  name: "exception_handler",
  type: "exception_handler",
  model: "claude-sonnet-4-6",
  user_facing_label: "Exception Handler",
  description:
    "Computes a remediation path for a flagged exception: re-enqueue the orchestrator, emit a human-actionable plan, reroute the corridor, or escalate.",
  prompt_path: "lib/prompts/exception_handler.md",
  tools: [
    {
      name: "read_case_state",
      description: "Read full case state before deciding. Call first.",
      input_schema: { type: "object" as const, properties: {} },
    },
    {
      name: "emit_remediation_plan",
      description:
        "Terminal: a concrete fix exists. Records the plan and notifies the operator.",
      input_schema: {
        type: "object" as const,
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
        "Terminal: the issue is a blocked route/cargo path; propose an alternate routing.",
      input_schema: {
        type: "object" as const,
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
        "Terminal: the case just needs the orchestrator to re-evaluate (e.g. new info arrived). Re-enqueue it.",
      input_schema: {
        type: "object" as const,
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
    {
      name: "escalate_to_human",
      description:
        "Terminal: no automated remediation; a human must intervene.",
      input_schema: {
        type: "object" as const,
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
        type: "object" as const,
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
