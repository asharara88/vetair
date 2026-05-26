// Status Watchdog — portfolio-level staleness sweep at the end of every
// orchestrator cycle. Implemented as a Supabase edge function
// (supabase/functions/status-watchdog-agent/index.ts) but registered here so
// the UI roster and agent registry can resolve it like any other agent.

import { type AgentDefinition, validateAgent } from "./types";

export const STATUS_WATCHDOG: AgentDefinition = validateAgent({
  name: "status_watchdog",
  type: "status_watchdog",
  model: "claude-sonnet-4-6",
  user_facing_label: "Status Watchdog",
  description:
    "Sweeps every open non-demo case after each orchestrator cycle. A SQL pre-filter flags stale cases by urgency window to target_date; Sonnet reasons per case and either dispatches the exception_handler, notifies a human operator, or marks benign.",
  prompt_path: "lib/prompts/status_watchdog.md",
  tools: [
    {
      name: "dispatch_exception",
      description:
        "Terminal: real, actionable problem. Hand the case to exception_handler with a clear problem statement.",
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
      description: "Terminal: worth a human glance, not an automated fix.",
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
        "Terminal: quiet but expected (far-off travel date, awaiting a known external wait).",
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
