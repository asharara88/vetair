// Status Watchdog — portfolio-level sweep. Fires at the end of an orchestrator
// cycle; a deterministic SQL filter nominates stale cases, then this agent
// decides per case whether silence is a problem or expected.
//
// Deployed as supabase/functions/status-watchdog-agent — this definition keeps
// the tool contract + budget authoritative in the TS registry so the Next.js
// architecture page, agent registry UI, and the edge function stay in sync.

import { type AgentDefinition, validateAgent } from "./types";

export const STATUS_WATCHDOG: AgentDefinition = validateAgent({
  name: "status_watchdog",
  type: "watchdog",
  model: "claude-sonnet-4-6",
  user_facing_label: "Status Watchdog",
  description:
    "Portfolio-level sweep of stale non-terminal cases. Deterministic SQL finds staleness; this agent decides whether to dispatch exception_handler, notify the operator, or mark benign.",
  prompt_path: "lib/prompts/status_watchdog.md",
  tools: [
    {
      name: "dispatch_exception",
      description:
        "Terminal: real, actionable problem. Hand this case to exception_handler with a concrete problem statement and severity.",
      input_schema: {
        type: "object" as const,
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
        "Terminal: worth a human glance but not an automated exception. Writes to agent_messages.",
      input_schema: {
        type: "object" as const,
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
        "Terminal: quiet but expected (far-off travel, awaiting a known external wait). No action.",
      input_schema: {
        type: "object" as const,
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: ["dispatch_exception", "notify_operator", "mark_benign"],
  // One LLM call per stale case; the edge function caps the sweep at 25 cases.
  budget: { max_turns: 1, max_input_tokens: 8_000 },
});
