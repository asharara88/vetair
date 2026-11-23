// Status Watchdog — reasons about a single stale case flagged by a
// deterministic SQL pre-filter. One reasoning call per flagged case;
// the containing edge-function sweep loops the deterministic step.
//
// Implementation lives in supabase/functions/status-watchdog-agent/.
// This module is the registry-side contract: static declaration of the
// tools, terminal set, and budget that the edge function enforces.

import { type AgentDefinition, validateAgent } from "./types";

export const STATUS_WATCHDOG: AgentDefinition = validateAgent({
  name: "status_watchdog",
  type: "watchdog",
  model: "claude-sonnet-4-6",
  user_facing_label: "Status Watchdog",
  description:
    "Sweeps open non-demo cases that a deterministic SQL filter flagged as stale and decides, per case, whether silence is a problem or expected.",
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
  budget: { max_turns: 2, max_input_tokens: 20_000 },
});
