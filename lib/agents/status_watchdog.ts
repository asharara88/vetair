// Status Watchdog — portfolio-level sweeper for stale non-terminal cases.
// Runs at the end of an orchestrator cycle. A deterministic SQL pre-filter
// selects stale candidates cheaply (no LLM cost); the agent then reasons per
// case about whether silence is urgent given the travel date.

import { type AgentDefinition, validateAgent } from "./types";

export const STATUS_WATCHDOG: AgentDefinition = validateAgent({
  name: "status_watchdog",
  type: "watchdog",
  model: "claude-sonnet-4-6",
  user_facing_label: "Status Watchdog",
  description:
    "Portfolio-level sweep. For each stale non-terminal case, decides whether to dispatch an exception handler, notify a human operator, or mark the silence benign.",
  prompt_path: "lib/prompts/status_watchdog.md",
  tools: [
    {
      name: "dispatch_exception",
      description:
        "Terminal: the case has a real, actionable problem. Hand it to the exception_handler agent with a concrete problem statement and severity.",
      input_schema: {
        type: "object",
        properties: {
          problem: { type: "string", description: "What is wrong, concretely." },
          severity: { type: "string", enum: ["critical", "high", "medium"] },
          suggested_action: { type: "string" },
        },
        required: ["problem", "severity"],
      },
    },
    {
      name: "notify_operator",
      description:
        "Terminal: worth a human's attention but not an automated exception. Writes a notification on the agent_messages bus.",
      input_schema: {
        type: "object",
        properties: {
          note: { type: "string" },
          severity: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["note"],
      },
    },
    {
      name: "mark_benign",
      description:
        "Terminal: the case is quiet but that is expected (e.g. far-off travel date, awaiting a known external wait). No action taken.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: ["dispatch_exception", "notify_operator", "mark_benign"],
  budget: { max_turns: 1, max_input_tokens: 8_000 },
});
