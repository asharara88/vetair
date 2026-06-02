// Exception Handler — remediation router.
// Triggered by status_watchdog (or any agent that flags an exception). Reads
// the case, then picks a remediation path: emit a plan, reroute the corridor,
// re-enqueue the orchestrator, escalate to a human, or fail loudly.

import { type AgentDefinition, validateAgent } from "./types";

export const EXCEPTION_HANDLER: AgentDefinition = validateAgent({
  name: "exception_handler",
  type: "exception",
  model: "claude-sonnet-4-6",
  user_facing_label: "Exception Handler",
  description:
    "Remediation router for case-level exceptions. Reads case state, picks the least-disruptive fix among: remediation plan, corridor reroute, orchestrator re-cycle, human escalation.",
  prompt_path: "lib/prompts/exception_handler.md",
  tools: [
    {
      name: "read_case_state",
      description: "Read full case context (owner, pet, latest assessment, latest audit, recent runs + messages) before deciding.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "emit_remediation_plan",
      description:
        "Terminal: a concrete fix exists. Records the plan as an operator notification with actionable steps.",
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
      description: "Terminal: route/cargo blockage (embargo, cancelled flight, no cargo space). Propose an alternate routing.",
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
      description: "Terminal: re-enqueue the case so the orchestrator re-evaluates (e.g. new info arrived).",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
    {
      name: "escalate_to_human",
      description: "Terminal: no automated remediation. Money, legal, or welfare is at stake. Stops automation.",
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
  budget: { max_turns: 4, max_input_tokens: 30_000 },
});
