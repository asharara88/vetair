// Status Watchdog — portfolio-level stale-case monitor (§2.3 watchdog pattern).
// Runtime: supabase/functions/status-watchdog-agent. A deterministic SQL
// pre-filter flags cases whose silence exceeds an urgency-scaled threshold
// (tighter as target_date nears); Sonnet then reasons about each flagged case
// one at a time and picks exactly one terminal. Read-only on case state.

import { type AgentDefinition, validateAgent } from "./types";

export const STATUS_WATCHDOG: AgentDefinition = validateAgent({
  name: "status_watchdog",
  type: "watchdog",
  model: "claude-sonnet-4-6",
  user_facing_label: "Status Watchdog",
  description:
    "Portfolio-level stale-case sweep. A deterministic SQL pre-filter flags cases whose silence exceeds an urgency-scaled threshold; Sonnet decides per case whether to dispatch the exception handler, notify a human operator, or mark it benign. Read-only on case state.",
  prompt_path: "lib/prompts/status_watchdog.md",
  tools: [
    {
      name: "dispatch_exception",
      description:
        "Terminal: this case has a real, actionable problem. Hand it to the exception_handler with a concrete problem statement.",
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
      description: "Terminal: worth a human's attention but not an automated exception. Writes a notification.",
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
  budget: { max_turns: 1, max_input_tokens: 20_000 },
});
