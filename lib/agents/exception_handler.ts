// Exception Handler — fired on signal (from status_watchdog, audit, or any
// agent that hits a hard exception). Computes a remediation path for a
// case-level problem and routes it back to the orchestrator (re-cycle),
// proposes a corridor re-route, emits a remediation plan for the operator,
// or escalates to human.
//
// Mirrors the running edge function at
// supabase/functions/exception-handler-agent/index.ts — this AgentDefinition
// is the registry handle the UI and dispatcher consume.

import { type AgentDefinition, validateAgent } from "./types";

export const EXCEPTION_HANDLER: AgentDefinition = validateAgent({
  name: "exception_handler",
  type: "exception_handler",
  model: "claude-sonnet-4-6",
  user_facing_label: "Exception Handler",
  description:
    "Computes remediation when a case hits a hard exception: re-cycle, re-route corridor, propose a fix, or escalate to human.",
  prompt_path: "lib/prompts/exception_handler.md",
  tools: [
    {
      name: "read_case_state",
      description: "Read the full case state (owner, pet, latest assessment, latest audit, recent runs + messages).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "emit_remediation_plan",
      description:
        "Terminal: a concrete fix exists. Records the plan steps and notifies the human operator.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          plan: { type: "string" },
          steps: { type: "array", items: { type: "string" }, minItems: 1 },
          requires_customer_action: { type: "boolean" },
        },
        required: ["case_id", "plan", "steps"],
      },
    },
    {
      name: "reroute_corridor",
      description:
        "Terminal: the original corridor is blocked; propose an alternate routing the orchestrator can re-plan around.",
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
        "Terminal: the case just needs the Orchestrator to re-evaluate (e.g. new info arrived). Re-enqueue without changing state.",
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
      description:
        "Terminal: no safe automated remediation. Sets assessment_state=escalated_to_human and notifies the operator.",
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
