// Status Watchdog — the read-only async monitor (AGENT.md §2.3, §3 #9).
// Runtime lives in supabase/functions/status-watchdog-agent; this manifest is
// the declarative twin so the orchestrator and registry can resolve it. It
// reasons about each stale case and routes to remediation, a human, or nothing.

import { type AgentDefinition, validateAgent } from "./types";

export const WATCHDOG: AgentDefinition = validateAgent({
  name: "watchdog",
  type: "watchdog",
  model: "claude-sonnet-4-6",
  user_facing_label: "Status Watchdog",
  description:
    "Read-only async monitor. Sweeps open cases flagged stale by a deterministic filter and decides per case: remediate, notify a human, or leave benign.",
  prompt_path: "lib/prompts/watchdog.md",
  tools: [
    {
      name: "read_open_cases",
      description: "Read open non-demo cases the deterministic pre-filter flagged stale (non-terminal state, no update inside the urgency window).",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "read_case_history",
      description: "Read the recent agent_runs and latest assessment for one case to judge whether its silence is a problem.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "dispatch_exception",
      description: "Terminal: real, actionable problem. Hand the case to the exception_handler with a concrete problem statement.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          problem: { type: "string" },
          severity: { type: "string", enum: ["critical", "high", "medium"] },
          suggested_action: { type: "string" },
        },
        required: ["case_id", "problem", "severity"],
      },
    },
    {
      name: "notify_operator",
      description: "Terminal: worth a human glance but not an automated fix. Writes a notification.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          note: { type: "string" },
          severity: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["case_id", "note"],
      },
    },
    {
      name: "mark_benign",
      description: "Terminal: quiet but expected (e.g. far-off travel date, awaiting a known external wait). No action.",
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
  terminal_tools: ["dispatch_exception", "notify_operator", "mark_benign"],
  budget: { max_turns: 4, max_input_tokens: 40_000 },
});
