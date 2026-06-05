// Exception Handler — remediation router for case-level problems.
// Executes inside supabase/functions/exception-handler-agent. The definition
// here is the registry contract.

import { type AgentDefinition, validateAgent } from "./types";

export const EXCEPTION_HANDLER: AgentDefinition = validateAgent({
  name: "exception_handler",
  type: "exception",
  model: "claude-sonnet-4-6",
  user_facing_label: "Exception Handler",
  description:
    "Given a flagged exception, reads case state and computes the least-disruptive remediation: re-cycle, reroute, plan, or escalate.",
  prompt_path: "lib/prompts/exception.md",
  tools: [
    {
      name: "read_case_state",
      description:
        "Read full case context (owner, pet, latest assessment + audit, recent runs and messages). Call first.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "emit_remediation_plan",
      description:
        "Terminal: a concrete fix exists. Records the plan and notifies the operator with actionable steps.",
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
        "Terminal: a genuine route/cargo blockage (embargo, cancelled flight, no cargo space). Propose an alternate routing.",
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
        "Terminal: the case just needs the orchestrator to re-evaluate (e.g. new info arrived). Re-enqueue it.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
    {
      name: "escalate_to_human",
      description:
        "Terminal: money, legal liability, or animal welfare is at stake and no safe automated path exists.",
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
  budget: { max_turns: 4, max_input_tokens: 40_000 },
});
