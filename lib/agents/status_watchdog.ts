// Status Watchdog — sweeps stale open cases at the end of every orchestrator cycle.
// Deterministic SQL pre-filter selects candidates; Sonnet then reasons per case.
// Edge function: supabase/functions/status-watchdog-agent.

import { type AgentDefinition, validateAgent } from "./types";

export const STATUS_WATCHDOG: AgentDefinition = validateAgent({
  name: "status_watchdog",
  type: "status_watchdog",
  model: "claude-sonnet-4-6",
  user_facing_label: "Status Watchdog",
  description:
    "Sweeps open cases at end of every orchestrator cycle. Per-case reasoning over staleness vs travel date — dispatches exception_handler, notifies operator, or marks benign.",
  prompt_path: "lib/prompts/status_watchdog.md",
  tools: [
    {
      name: "dispatch_exception",
      description:
        "Terminal: this case has a real, actionable problem. Hand it to exception_handler with a clear problem statement.",
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
        "Terminal: worth a human's attention but not an automated exception. Writes an operator notification.",
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
        "Terminal: case is quiet but the silence is expected (e.g. far-off travel date, awaiting a known external wait). No action.",
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
