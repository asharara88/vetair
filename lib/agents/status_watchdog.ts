// Status Watchdog — portfolio sweep. Fires at the end of every orchestrator cycle.
// Deterministic SQL pre-filter finds stale open cases; the agent reasons per
// case about whether silence is a real problem or merely expected.

import { type AgentDefinition, validateAgent } from "./types";

export const STATUS_WATCHDOG: AgentDefinition = validateAgent({
  name: "status_watchdog",
  type: "watchdog",
  model: "claude-sonnet-4-6",
  user_facing_label: "Status Watchdog",
  description:
    "Portfolio sweep at the end of each orchestrator cycle. SQL pre-filter detects stale open cases; the agent decides per case whether silence is actionable.",
  prompt_path: "lib/prompts/status_watchdog.md",
  tools: [
    {
      name: "dispatch_exception",
      description:
        "Terminal: real, actionable problem. Hand the case to exception_handler with a concrete problem statement.",
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
        "Terminal: worth a human glance but not an automated fix. Writes an agent_messages notification.",
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
      description: "Terminal: quiet but expected (far-off target date, awaiting external wait). No action.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: ["dispatch_exception", "notify_operator", "mark_benign"],
  // One LLM call per stale case, no multi-turn loop. Per-call token cap reflects the
  // edge function's max_tokens=1024 + system + per-case context.
  budget: { max_turns: 1, max_input_tokens: 8_000 },
});
