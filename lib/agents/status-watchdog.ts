// Status Watchdog — portfolio-level sweep that fires after every orchestrator
// cycle. Wraps the supabase/functions/status-watchdog-agent edge function so
// the orchestrator can dispatch it like any registered agent. The edge
// function holds the sweep logic; this definition is the tool surface the
// orchestrator sees.

import { type AgentDefinition, validateAgent } from "./types";

export const STATUS_WATCHDOG: AgentDefinition = validateAgent({
  name: "status_watchdog",
  type: "status_watchdog",
  model: "claude-sonnet-4-6",
  user_facing_label: "Status Watchdog",
  description:
    "Portfolio sweep. Fires at the end of every orchestrator cycle, finds stale open cases, and decides per case: dispatch exception, notify operator, or mark benign.",
  prompt_path: "lib/prompts/status-watchdog.md",
  tools: [
    {
      name: "list_stale_candidates",
      description:
        "Deterministic SQL pre-filter that returns open non-demo cases whose updated_at exceeds the urgency-window threshold.",
      input_schema: {
        type: "object",
        properties: {
          triggered_by_case: {
            type: "string",
            description: "Informational — the case whose orchestrator cycle fired this sweep.",
          },
        },
      },
    },
    {
      name: "read_case_context",
      description:
        "Enrich one stale candidate with corridor, latest verdict, and days_until_travel before deciding.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "dispatch_exception",
      description:
        "Terminal (per case): real, actionable problem. Hands the case to the exception_handler with a clear problem statement.",
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
        "Terminal (per case): worth a human glance but not an automated exception. Writes an operator notification.",
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
    {
      name: "sweep_complete",
      description: "Terminal (sweep): close the watchdog run after every stale candidate has been resolved.",
      input_schema: {
        type: "object",
        properties: {
          open_cases: { type: "integer", minimum: 0 },
          stale_detected: { type: "integer", minimum: 0 },
          reasoned: { type: "integer", minimum: 0 },
        },
        required: ["open_cases", "stale_detected", "reasoned"],
      },
    },
  ],
  terminal_tools: ["sweep_complete"],
  budget: { max_turns: 30, max_input_tokens: 120_000 },
});
