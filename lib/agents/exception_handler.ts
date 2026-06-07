// Exception Handler — computes a remediation when a case hits an exception.
// Companion runtime lives in `supabase/functions/exception-handler-agent`;
// this definition is the registry surface and the source of truth for the
// terminal-tool contract.

import { type AgentDefinition, validateAgent } from "./types";

export const EXCEPTION_HANDLER: AgentDefinition = validateAgent({
  name: "exception_handler",
  type: "exception_handler",
  model: "claude-sonnet-4-6",
  user_facing_label: "Exception Handler",
  description:
    "Fired by the watchdog or any agent that hits an exception. Reads case state, picks the least-disruptive remediation, and either reroutes, requests a re-evaluation, emits a manual plan, or escalates.",
  prompt_path: "lib/prompts/exception_handler.md",
  tools: [
    {
      name: "read_case_state",
      description:
        "Read full case state — owner, pet, latest assessment, latest audit, recent runs and inter-agent messages. Call first.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "emit_remediation_plan",
      description:
        "Terminal: a concrete fix exists, expressible as a sequence of operator steps. Records the plan and notifies the human operator.",
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
        "Terminal: a genuine route/cargo blockage (embargo, cancelled flight, no cargo space). Propose an alternate routing for the airline_crate agent to re-plan against.",
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
        "Terminal: case just needs the orchestrator to re-evaluate (new info arrived, customer replied). Re-enqueues it.",
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
        "Terminal: no safe automated path. Used when money, legal liability, or animal welfare is at stake.",
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
      description:
        "Terminal: could not compute a remediation within the turn budget. Logs and escalates.",
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
