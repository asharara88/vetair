// Status Watchdog — portfolio-level staleness sweep.
// Fires at the end of an orchestrator cycle. A deterministic SQL pre-filter
// finds non-terminal cases whose last update is older than an urgency-tightened
// threshold; the agent then reasons per stale case about whether silence is
// EXPECTED (far-off travel, awaiting a known external wait) or a real PROBLEM,
// and chooses one terminal: dispatch_exception, notify_operator, or mark_benign.
//
// The edge implementation lives at supabase/functions/status-watchdog-agent/.

import { type AgentDefinition, validateAgent } from "./types";

export const STATUS_WATCHDOG: AgentDefinition = validateAgent({
  name: "status_watchdog",
  type: "watchdog",
  model: "claude-sonnet-4-6",
  user_facing_label: "Status Watchdog",
  description:
    "Sweeps open non-demo cases for staleness given travel-date urgency. Reasons per case about whether silence is benign or a real problem; dispatches an exception, notifies an operator, or marks benign.",
  prompt_path: "lib/prompts/status_watchdog.md",
  tools: [
    {
      name: "dispatch_exception",
      description:
        "Terminal: this case has a real, actionable problem. Hand it to exception_handler with a concrete problem statement and severity.",
      input_schema: {
        type: "object",
        properties: {
          problem: { type: "string" },
          severity: { type: "string", enum: ["critical", "high", "medium"] },
          suggested_action: { type: "string" },
        },
        required: ["problem", "severity"],
      },
    },
    {
      name: "notify_operator",
      description:
        "Terminal: worth a human glance but not an automated exception. Writes an operator-visible notification.",
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
        "Terminal: the case is quiet but that is expected (e.g. far-off travel date, awaiting a known external wait). No action.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: ["dispatch_exception", "notify_operator", "mark_benign"],
  // One-shot per stale case: the agent receives the case context with the
  // request and chooses a terminal immediately, no follow-up tool calls.
  budget: { max_turns: 1, max_input_tokens: 20_000 },
});
