// Status Watchdog — read-only auditor that runs at the tail of every
// orchestrator cycle. A deterministic SQL pre-filter selects stale cases; this
// agent reasons about whether the silence is benign or a real problem.
//
// Mirrors the runtime in supabase/functions/status-watchdog-agent — keep tool
// names and terminal set in sync with that edge function.

import { type AgentDefinition, validateAgent } from "./types";

const SEVERITY_HIGH = ["critical", "high", "medium"] as const;
const SEVERITY_LOW = ["high", "medium", "low"] as const;

export const STATUS_WATCHDOG: AgentDefinition = validateAgent({
  name: "status_watchdog",
  type: "watchdog",
  model: "claude-sonnet-4-6",
  user_facing_label: "Status Watchdog",
  description:
    "Read-only auditor. Runs after every orchestrator cycle; reasons per stale case whether silence is benign or a real problem and routes accordingly.",
  prompt_path: "lib/prompts/status_watchdog.md",
  tools: [
    {
      name: "dispatch_exception",
      description: "Terminal: this case has a real, actionable problem. Hand it to the exception_handler with a clear problem statement.",
      input_schema: {
        type: "object",
        properties: {
          problem: { type: "string" },
          severity: { type: "string", enum: [...SEVERITY_HIGH] },
          suggested_action: { type: "string" },
        },
        required: ["problem", "severity"],
      },
    },
    {
      name: "notify_operator",
      description: "Terminal: worth a human glance but not an automated exception. Writes a notification.",
      input_schema: {
        type: "object",
        properties: {
          note: { type: "string" },
          severity: { type: "string", enum: [...SEVERITY_LOW] },
        },
        required: ["note"],
      },
    },
    {
      name: "mark_benign",
      description: "Terminal: the case is quiet but that is expected (far-off travel, awaiting a known external wait). No action.",
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
