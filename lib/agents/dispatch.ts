// Dispatch-side helpers shared by the orchestrator runtime, the UI, and the
// Supabase edge functions. Pure functions — no I/O, no Supabase.

import type { AgentDefinition } from "./types";
import { STATIC_AGENTS_BY_NAME } from "./registry-store";
import { buildSpecialist, type SpecialistParams } from "./specialist";

// ---------- specialist name parsing ----------

const SPECIALIST_NAME_RE = /^([a-z]{2})_compliance_specialist$/;

/** True for any name that follows the synthesized-specialist pattern. */
export const isSpecialistName = (name: string): boolean =>
  SPECIALIST_NAME_RE.test(name);

/**
 * Pull the country code out of a synthesized specialist name.
 * Returns the uppercase ISO-3166 alpha-2 code, or `null` if `name` doesn't
 * match the specialist pattern.
 */
export function parseSpecialistName(name: string): { country_code: string } | null {
  const m = SPECIALIST_NAME_RE.exec(name);
  return m ? { country_code: m[1].toUpperCase() } : null;
}

// ---------- agent resolution ----------

/**
 * Resolve any agent name to a definition. For synthesized specialists the
 * caller must supply the row's `synthesis_params` so the prompt can be
 * parameterized; without them we return `null` so the dispatcher knows to
 * load the row from `synthesized_specialists`.
 */
export function resolveAgent(
  name: string,
  options?: { specialistParams?: SpecialistParams; model?: AgentDefinition["model"] },
): AgentDefinition | null {
  const staticDef = STATIC_AGENTS_BY_NAME[name];
  if (staticDef) return staticDef;
  if (!isSpecialistName(name)) return null;
  const params = options?.specialistParams;
  if (!params) return null;
  return buildSpecialist(params, options?.model);
}

// ---------- terminal-tool semantics ----------
//
// Every agent terminates by calling one of its `terminal_tools`. The
// orchestrator translates that into a coarse loop effect:
//
//   "complete" — agent finished its job successfully (case may progress).
//   "handoff"  — agent finished and asked us to dispatch another agent.
//   "yield"    — agent is waiting on an external signal (owner reply, doc upload).
//   "halt"     — agent failed or escalated; case stops until human action.

export type TerminalEffect = "complete" | "handoff" | "yield" | "halt";

const TERMINAL_EFFECT: Record<string, TerminalEffect> = {
  // Orchestrator
  dispatch_to_agent: "handoff",
  escalate_to_human: "halt",
  close_case: "complete",
  acknowledge_and_wait: "yield",

  // Intake
  handoff_to_compliance: "handoff",
  ask_user_for_input: "yield",

  // Document
  emit_extraction: "complete",
  fail_extraction: "halt",

  // Compliance + Specialist
  emit_assessment: "complete",
  request_document: "yield",

  // Auditor
  concur: "complete",
  dissent: "halt",

  // Synthesizer
  register_specialist: "complete",
  fail_synthesis: "halt",
};

/** Coarse loop effect for a terminal tool. Unknown tools default to `"complete"`. */
export function terminalToolEffect(tool: string | null | undefined): TerminalEffect {
  if (!tool) return "complete";
  return TERMINAL_EFFECT[tool] ?? "complete";
}

/** True iff `tool` is a registered terminal tool on `def`. */
export function isTerminalToolOf(def: AgentDefinition, tool: string): boolean {
  return def.terminal_tools.includes(tool);
}
