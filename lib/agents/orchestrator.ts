// Orchestrator — case state machine, task dispatch, consensus mediation.
// Reads the queue, decides which agent runs next, enforces the per-case budget.

import { type AgentDefinition, validateAgent } from "./types";
import { CASE_ID_INPUT, TERMINAL_ACK, caseIdInputWith } from "./shared";

export const ORCHESTRATOR: AgentDefinition = validateAgent({
  name: "orchestrator",
  type: "orchestrator",
  model: "claude-sonnet-4-6",
  user_facing_label: "Case Coordinator",
  description:
    "Reads case state from the queue and decides which agent to dispatch next. Enforces the per-case budget (20 invocations, 500K tokens, 2 dissent rounds).",
  prompt_path: "lib/prompts/orchestrator.md",
  tools: [
    {
      name: "list_active_agents",
      description: "Read the agent_registry table for all active agents (active dispatch targets).",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "read_case",
      description: "Read a case row by id, including state and budget counters.",
      input_schema: CASE_ID_INPUT,
    },
    {
      name: "read_recent_runs",
      description: "Read the last N agent_runs for a case to inspect dispatch history.",
      input_schema: caseIdInputWith({
        limit: { type: "integer", minimum: 1, maximum: 50 },
      }),
    },
    {
      name: "dispatch_to_agent",
      description: "Enqueue a task targeting another active agent.",
      input_schema: caseIdInputWith(
        { agent_name: { type: "string" }, payload: { type: "object" } },
        ["agent_name"],
      ),
    },
    {
      name: "escalate_to_human",
      description: "Route the case to the human break-glass queue. Use when budget is exhausted or the auditor has dissented twice.",
      input_schema: caseIdInputWith({ reason: { type: "string" } }, ["reason"]),
    },
    {
      name: "close_case",
      description: "Terminal: close the case with a final outcome.",
      input_schema: caseIdInputWith(
        { outcome: { type: "string", enum: ["approved", "blocked", "cancelled"] } },
        ["outcome"],
      ),
    },
    TERMINAL_ACK,
  ],
  terminal_tools: ["dispatch_to_agent", "escalate_to_human", "close_case", "acknowledge_and_wait"],
  budget: { max_turns: 8, max_input_tokens: 80_000, max_dissent_rounds: 2 },
});
