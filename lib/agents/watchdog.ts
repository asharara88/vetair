// Status Watchdog — read-only portfolio-level sweep. Deterministic SQL
// pre-filter surfaces stale cases, then the LLM reasons per case about whether
// silence is a problem or expected. Mirrors supabase/functions/status-watchdog-agent.

import { type AgentDefinition, validateAgent } from "./types";

export const WATCHDOG: AgentDefinition = validateAgent({
  name: "status_watchdog",
  type: "watchdog",
  model: "claude-sonnet-4-6",
  user_facing_label: "Status Watchdog",
  description:
    "Read-only async sweep. Flags stale cases by urgency, citation gaps, deterministic/LLM disagreement, and SLA breach risk.",
  prompt_path: "lib/prompts/watchdog.md",
  tools: [
    {
      name: "dispatch_exception",
      description:
        "Terminal (per-case): this case has a real, actionable problem. Hands it to the exception_handler agent with a concrete problem statement + severity.",
      input_schema: {
        type: "object",
        properties: {
          problem: {
            type: "string",
            description: "What is wrong, concretely. Reference the stale state or missed window.",
          },
          severity: { type: "string", enum: ["critical", "high", "medium"] },
          suggested_action: { type: "string" },
        },
        required: ["problem", "severity"],
      },
    },
    {
      name: "notify_operator",
      description:
        "Terminal (per-case): worth a human glance but not an automated exception. Writes an agent_messages notification to human_operator.",
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
        "Terminal (per-case): quiet but expected (e.g. far-off travel date, awaiting a known external wait). No write; just an audit-log line.",
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
