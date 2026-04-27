// Orchestrator — agent #0.
//
// Runs the case state machine and dispatches tasks to specialist agents.
// State transitions are the ONLY mutations of cases.state — every other
// agent emits work via task_queue and the orchestrator decides what to do.
//
// This module is deliberately deterministic (no LLM call). Promotion logic
// lives in code, not in a model. The Sonnet model id on the meta is a
// placeholder for the (future) "explain why we transitioned" annotation.

import "server-only";
import type { AgentName, CaseState } from "@/types/database";
import type { AgentContext, AgentMeta, AgentResult } from "./types";
import { modelFor } from "./models";
import { recordAgentRun } from "./log";

export const meta: AgentMeta = {
  name: "orchestrator",
  description: "Routes cases through the state machine; dispatches to specialist agents.",
  default_model: modelFor("orchestrator"),
  input_budget_tokens: 8_000,
};

// State machine — directed graph of allowed transitions. Mirrors the diagram
// in AGENT.md §8. Anything not listed here is an illegal transition and
// transitionTo() will refuse it.
const ALLOWED_TRANSITIONS: Record<CaseState, CaseState[]> = {
  draft:          ["intake", "cancelled"],
  intake:         ["assessment", "cancelled"],
  assessment:     ["approved", "blocked", "cancelled"],
  blocked:        ["assessment", "cancelled"], // can re-evaluate after new docs
  approved:       ["documentation", "cancelled"],
  documentation:  ["vet_procedures", "cancelled"],
  vet_procedures: ["booking", "cancelled"],
  booking:        ["transit", "cancelled"],
  transit:        ["arrived", "cancelled"],
  arrived:        ["closed"],
  closed:         [],
  cancelled:      [],
};

export function canTransition(from: CaseState, to: CaseState): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function transitionTo(
  ctx: AgentContext,
  next: CaseState,
  reason: string,
): Promise<AgentResult<{ from: CaseState; to: CaseState }>> {
  const started = Date.now();
  const { data: caseRow, error: readErr } = await ctx.supabase
    .from("cases")
    .select("state")
    .eq("id", ctx.case_id)
    .single();

  if (readErr || !caseRow) {
    const result: AgentResult<{ from: CaseState; to: CaseState }> = {
      ok: false,
      decision_summary: `Could not read case ${ctx.case_id}: ${readErr?.message ?? "missing"}`,
      confidence: 0,
      citations: [],
      latency_ms: Date.now() - started,
      error: readErr?.message ?? "case not found",
    };
    await recordAgentRun(ctx.supabase, "orchestrator", ctx.case_id, result);
    return result;
  }

  const current = caseRow.state as CaseState;
  if (!canTransition(current, next)) {
    const result: AgentResult<{ from: CaseState; to: CaseState }> = {
      ok: false,
      decision_summary: `Refused illegal transition ${current} → ${next}: ${reason}`,
      confidence: 1,
      citations: [],
      latency_ms: Date.now() - started,
      error: "illegal transition",
    };
    await recordAgentRun(ctx.supabase, "orchestrator", ctx.case_id, result);
    return result;
  }

  const { error: updErr } = await ctx.supabase
    .from("cases")
    .update({ state: next })
    .eq("id", ctx.case_id);

  const result: AgentResult<{ from: CaseState; to: CaseState }> = {
    ok: !updErr,
    output: { from: current, to: next },
    decision_summary: `Transitioned ${current} → ${next}: ${reason}`,
    confidence: 1,
    citations: [],
    latency_ms: Date.now() - started,
    error: updErr?.message,
  };
  await recordAgentRun(ctx.supabase, "orchestrator", ctx.case_id, result, {
    input_payload: { current, next, reason },
    output_payload: { from: current, to: next },
  });
  return result;
}

export async function enqueueTask(
  ctx: AgentContext,
  args: {
    target_agent: AgentName;
    task_type: string;
    priority?: number;
    payload?: Record<string, unknown>;
    source_agent?: AgentName;
  },
): Promise<{ ok: boolean; task_id?: string; error?: string }> {
  const { data, error } = await ctx.supabase
    .from("task_queue")
    .insert({
      case_id: ctx.case_id,
      source_agent: args.source_agent ?? "orchestrator",
      target_agent: args.target_agent,
      task_type: args.task_type,
      priority: args.priority ?? 50,
      payload: args.payload ?? {},
      status: "queued",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, task_id: data?.id };
}

// Default run() is a no-op probe used by health-checks and tests.
export async function run(ctx: AgentContext): Promise<AgentResult> {
  const result: AgentResult = {
    ok: true,
    decision_summary: "Orchestrator probe: state machine and dispatch reachable.",
    confidence: 1,
    citations: [],
    latency_ms: 0,
    output: { case_id: ctx.case_id },
  };
  await recordAgentRun(ctx.supabase, "orchestrator", ctx.case_id, result);
  return result;
}
