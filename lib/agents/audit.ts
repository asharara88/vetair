// Audit — read-only watchdog (see AGENT.md §2.3).
// Runs at the end of every orchestrator cycle and on a portfolio sweep.
// Companion runtime lives in `supabase/functions/status-watchdog-agent`;
// this definition is the source of truth for the registry surface.

import { type AgentDefinition, validateAgent } from "./types";

export const AUDIT: AgentDefinition = validateAgent({
  name: "audit",
  type: "audit",
  model: "claude-haiku-4-5",
  user_facing_label: "Status Watchdog",
  description:
    "Portfolio-wide watchdog. After each orchestrator cycle it sweeps non-terminal cases, flags genuine stalls (vs benign quiet), and either notifies an operator or dispatches the exception handler.",
  prompt_path: "lib/prompts/audit.md",
  tools: [
    {
      name: "list_stale_cases",
      description:
        "Deterministic SQL pre-filter. Returns open non-demo cases where updated_at exceeds the urgency-weighted staleness threshold (1d if travel imminent, 10d if far out).",
      input_schema: {
        type: "object",
        properties: { triggered_by_case: { type: "string" } },
      },
    },
    {
      name: "read_case_signal",
      description:
        "Read the minimum signal needed to decide if a stale case is actually urgent: assessment_state, days_to_target, latest verdict + summary.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "dispatch_exception",
      description:
        "Terminal: route the case to the exception_handler with a concrete problem statement. Use only when silence is actionable (e.g. travel imminent, missing reply).",
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
        "Terminal: write a human-facing notification. Worth a glance, not an automated fix.",
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
        "Terminal: quiet but expected (e.g. travel is far out, awaiting a known external wait). No write beyond the audit log.",
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
  budget: { max_turns: 4, max_input_tokens: 30_000 },
});
