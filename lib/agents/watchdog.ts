// Status Watchdog — portfolio-level staleness monitor.
// Executes inside supabase/functions/status-watchdog-agent. The definition
// here is the registry contract — it's what the architecture page and the
// orchestrator dispatch layer reason about.

import { type AgentDefinition, validateAgent } from "./types";

export const STATUS_WATCHDOG: AgentDefinition = validateAgent({
  name: "status_watchdog",
  type: "watchdog",
  model: "claude-sonnet-4-6",
  user_facing_label: "Status Watchdog",
  description:
    "Portfolio sweep. Deterministic SQL pre-filter finds stale cases; Sonnet per-case decides dispatch vs notify vs benign.",
  prompt_path: "lib/prompts/watchdog.md",
  tools: [
    {
      name: "dispatch_exception",
      description:
        "Terminal: hand the stale case to the exception_handler with a concrete problem statement and severity.",
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
        "Terminal: worth a human glance but no automated fix. Writes a notification message.",
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
        "Terminal: the case is quiet but that silence is expected (far-off travel date, known external wait).",
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
