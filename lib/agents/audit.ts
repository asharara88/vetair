// Audit — read-only watchdog. Sweeps open cases for stale state, citation
// gaps, deterministic-vs-LLM divergence and routes the real issues to the
// exception handler. Mirrors the deployed `status-watchdog-agent` edge function.

import { type AgentDefinition, validateAgent } from "./types";

export const AUDIT: AgentDefinition = validateAgent({
  name: "status_watchdog",
  type: "audit",
  model: "claude-sonnet-4-6",
  user_facing_label: "Audit Watchdog",
  description:
    "Read-only watchdog. Sweeps open cases for staleness, citation gaps, deterministic-vs-LLM divergence and routes real issues to the exception handler.",
  prompt_path: "lib/prompts/audit.md",
  tools: [
    {
      name: "read_open_cases",
      description:
        "List non-terminal cases, optionally filtered by staleness or extraction confidence.",
      input_schema: {
        type: "object",
        properties: {
          stale_threshold_hours: { type: "number", minimum: 1 },
          has_extraction_below: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
    {
      name: "read_case_runs",
      description: "Read recent agent runs for a case to see what is going on.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 30 },
        },
        required: ["case_id"],
      },
    },
    {
      name: "read_assessment",
      description: "Read the most recent non-superseded compliance assessment.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "check_citation_coverage",
      description:
        "Audit a case's customer-facing claims for citation coverage. Returns the codes that should have been cited but were not.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "dispatch_exception",
      description:
        "Terminal: hand a real, actionable problem to the exception_handler with a concrete problem statement.",
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
        "Terminal: worth a human glance but not an automated exception. Writes a notification.",
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
        "Terminal: the case is quiet but that is expected (far-off travel, awaiting a known external wait). No action.",
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
