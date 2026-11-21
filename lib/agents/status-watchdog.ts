// Status Watchdog — portfolio-level sweep. At the end of each orchestrator
// cycle the orchestrator fires this edge function (see
// supabase/functions/status-watchdog-agent). Deterministic SQL finds stale
// non-terminal cases, Sonnet reasons about each one, then chooses:
//   - dispatch_exception  → hand to exception_handler
//   - notify_operator     → write an operator notification
//   - mark_benign         → silence is expected
//
// This file is the static registry entry — the runtime implementation lives in
// the edge function above. Mirrors its terminal tool manifest exactly so
// AGENT_META and the architecture UI can describe it the same way.

import { type AgentDefinition, validateAgent } from "./types";

export const STATUS_WATCHDOG: AgentDefinition = validateAgent({
  name: "status_watchdog",
  type: "watchdog",
  model: "claude-sonnet-4-6",
  user_facing_label: "Status Watchdog",
  description:
    "Portfolio-level sweep. Finds stale non-terminal cases deterministically, then reasons case-by-case to dispatch, notify, or mark benign.",
  prompt_path: "lib/prompts/status-watchdog.md",
  tools: [
    {
      name: "dispatch_exception",
      description:
        "Terminal: real, actionable problem. Hand to exception_handler with problem + severity + suggested action.",
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
      description: "Terminal: worth human attention, not an automated fix.",
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
      description: "Terminal: quiet but expected. No action.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: ["dispatch_exception", "notify_operator", "mark_benign"],
  budget: { max_turns: 2, max_input_tokens: 20_000 },
});
