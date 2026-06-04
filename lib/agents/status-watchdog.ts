// Status Watchdog — portfolio-level sweeper. Fired at the end of an orchestrator
// cycle. Deterministic SQL pre-filter finds STALE non-terminal cases (staleness
// threshold tightens as target_date approaches), then Sonnet reasons about each
// stale case and dispatches an exception, notifies the operator, or marks benign.

import { type AgentDefinition, validateAgent } from "./types";

export const STATUS_WATCHDOG: AgentDefinition = validateAgent({
  name: "status_watchdog",
  type: "status_watchdog",
  model: "claude-sonnet-4-6",
  user_facing_label: "Status Watchdog",
  description:
    "Portfolio sweeper. Deterministic pre-filter finds stale cases; reasons per-case about real urgency vs. expected silence; dispatches exceptions, notifies operators, or marks benign.",
  prompt_path: "lib/prompts/status-watchdog.md",
  tools: [
    {
      name: "dispatch_exception",
      description:
        "Terminal: this case has a real, actionable problem. Hand it to the exception_handler agent with a clear problem statement.",
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
        "Terminal: the case is quiet but that is expected (e.g. far-off travel date, awaiting a known external wait). No action.",
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
