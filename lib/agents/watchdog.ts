// Status Watchdog — async sweep over open non-demo cases.
// Lives as the `status-watchdog-agent` edge function; this AgentDefinition
// is the registry-side handle so it appears alongside the other agents in
// the Architecture page and gets the same dispatch routing treatment.

import { type AgentDefinition, validateAgent } from "./types";

export const WATCHDOG: AgentDefinition = validateAgent({
  name: "status_watchdog",
  type: "watchdog",
  model: "claude-sonnet-4-6",
  user_facing_label: "Status Watchdog",
  description:
    "Async sweep. Flags stale non-terminal cases against a deadline-aware threshold and decides whether silence is a problem or expected.",
  prompt_path: "lib/prompts/watchdog.md",
  tools: [
    {
      name: "list_stale_cases",
      description:
        "Deterministic pre-filter. Returns open non-demo cases whose updated_at exceeds the urgency threshold for their target_date.",
      input_schema: {
        type: "object",
        properties: {
          max_cases: { type: "integer", minimum: 1, maximum: 50, description: "Safety cap on LLM calls per sweep." },
        },
      },
    },
    {
      name: "read_case_context",
      description:
        "Read enriched context for a single stale case: latest assessment verdict + summary, recent run history, hours since last update.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "dispatch_exception",
      description:
        "Terminal (per case): hand the case to exception_handler with a problem statement and severity.",
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
      description:
        "Terminal (per case): worth a human glance, not an automated exception. Writes a notification to the operator queue.",
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
      description:
        "Terminal (per case): the case is quiet but that is expected (e.g. far-off travel date, awaiting a known external wait). No action.",
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
  budget: { max_turns: 25, max_input_tokens: 80_000 },
});
