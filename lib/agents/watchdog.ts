// Status Watchdog — sweeps open non-demo cases at the end of every orchestrator
// cycle. Deterministic SQL pre-filter cheaply finds STALE cases; the model
// reasons per case about real urgency vs expected silence and chooses one of
// dispatch_exception, notify_operator, or mark_benign.
//
// Mirrors the contract enforced by supabase/functions/status-watchdog-agent.

import { type AgentDefinition, validateAgent } from "./types";

export const WATCHDOG: AgentDefinition = validateAgent({
  name: "status_watchdog",
  type: "status_watchdog",
  model: "claude-sonnet-4-6",
  user_facing_label: "Status Watchdog",
  description:
    "Sweeps open non-demo cases for staleness at end of every orchestrator cycle. Decides per case: dispatch an exception, notify a human, or mark benign.",
  prompt_path: "lib/prompts/watchdog.md",
  tools: [
    {
      name: "dispatch_exception",
      description:
        "Terminal: this case has a real, actionable problem. Hands it to exception_handler with a clear problem statement.",
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
        "Terminal: worth a human's attention but not an automated exception. Writes a notification.",
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
        "Terminal: the case is quiet but that silence is expected (far-off target_date, awaiting a known external wait). No action.",
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
