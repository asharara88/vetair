// Exception Handler — fired by the watchdog (or any agent that hits an
// exception). Reads case state, computes a remediation path, and routes it
// through one terminal: emit a plan, reroute the corridor, request another
// orchestrator cycle, escalate to a human, or fail.
//
// Mirrors the contract enforced by supabase/functions/exception-handler-agent.

import { type AgentDefinition, validateAgent } from "./types";
import { ESCALATE_TO_HUMAN_TOOL } from "./shared-tools";

export const EXCEPTION_HANDLER: AgentDefinition = validateAgent({
  name: "exception_handler",
  type: "exception_handler",
  model: "claude-sonnet-4-6",
  user_facing_label: "Exception Handler",
  description:
    "Computes a remediation path for a flagged case. Prefers the least-disruptive fix; escalates only when money, legal liability, or animal welfare is at stake.",
  prompt_path: "lib/prompts/exception_handler.md",
  tools: [
    {
      name: "read_case_state",
      description:
        "Read full case state — owner, pet, latest assessment + audit, recent runs, recent messages. Call this first.",
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
        "Terminal: the issue is a genuine route/cargo blockage (embargo, cancelled flight, no cargo space). Propose an alternate routing.",
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
        "Terminal: the case just needs the orchestrator to re-evaluate (new info arrived). Re-enqueues it on the orchestrator_queue.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
    ESCALATE_TO_HUMAN_TOOL,
    {
      name: "fail_exception",
      description:
        "Terminal: could not compute a safe remediation. Logs and escalates.",
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
