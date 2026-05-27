// Vetair · status-watchdog-agent v1
// Registry contract: lib/agents/status_watchdog.ts
// Canonical prompt:  lib/prompts/status_watchdog.md
// When you edit SYSTEM_PROMPT below, mirror the change into the markdown.
//
// Fires at the end of an orchestrator cycle (orchestrator calls this after its terminal).
// Sweeps ALL open non-demo cases (not just the triggering case) — closes the
// low-volume blind spot as much as an event-driven design can.
//
// Design (per Ahmed 2026-05-20):
//  - Deterministic SQL pre-filter finds STALE candidates cheaply (no LLM cost).
//    Staleness = non-terminal assessment_state AND updated_at older than a
//    threshold that TIGHTENS as target_date approaches.
//  - Sonnet then reasons about EACH stale case: is this actually urgent given
//    the travel date, or merely quiet? Decides per case: dispatch exception_handler,
//    notify human_operator, or mark benign.
//  - Registry-aware: every run writes agent_runs; respects the same conventions
//    as orchestrator v9. Never blocks; on any error the run fails soft.
//
// KNOWN LIMITATION (flagged, not a bug): if the whole system goes silent (no
// orchestrator cycle fires at all for days), this never runs. v0-acceptable at
// low volume with manual oversight. Add pg_cron daily backstop when volume grows.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MODEL = "claude-sonnet-4-6";
const INPUT_PRICE_PER_M = 3.0;
const OUTPUT_PRICE_PER_M = 15.0;
const MAX_STALE_CASES_PER_SWEEP = 25; // safety cap on LLM calls per sweep

type JsonObj = Record<string, unknown>;
const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// Terminal assessment states — cases here are done, never stale.
const TERMINAL_STATES = ["rejected", "approved", "conditionally_approved"];

// Staleness thresholds (hours since updated_at) by urgency window to target_date.
// The closer the travel date, the less silence we tolerate.
function staleThresholdHours(daysToTarget: number | null): number {
  if (daysToTarget === null) return 168;      // no date: 7 days
  if (daysToTarget <= 7) return 24;            // travel imminent: 1 day
  if (daysToTarget <= 30) return 72;           // within a month: 3 days
  if (daysToTarget <= 90) return 120;          // within a quarter: 5 days
  return 240;                                  // far out: 10 days
}

const WATCHDOG_TOOLS = [
  { name: "dispatch_exception", description: "TERMINAL. This case has a real, actionable problem. Hand it to the exception_handler agent with a clear problem statement.", input_schema: { type: "object", properties: { problem: { type: "string", description: "What is wrong, concretely" }, severity: { type: "string", enum: ["critical", "high", "medium"] }, suggested_action: { type: "string" } }, required: ["problem", "severity"] } },
  { name: "notify_operator", description: "TERMINAL. Worth a human's attention but not an automated exception. Writes a notification.", input_schema: { type: "object", properties: { note: { type: "string" }, severity: { type: "string", enum: ["high", "medium", "low"] } }, required: ["note"] } },
  { name: "mark_benign", description: "TERMINAL. The case is quiet but that is expected (e.g. far-off travel date, awaiting a known external wait). No action.", input_schema: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"] } }
];

const SYSTEM_PROMPT = `You are the Status Watchdog for Vetair, a pet relocation Multi-Agent System.

A case has been flagged STALE by a deterministic filter: it is in a non-terminal state and has not been updated within its urgency window. Your job is to decide whether that silence is a PROBLEM or EXPECTED.

You receive one stale case at a time with: current state, assessment_state, days since last update, days until target travel date, latest assessment verdict, and recent activity.

Reason about REAL urgency, not just elapsed time:
 - A case awaiting a lab result with travel 6 months out is NOT urgent — silence is expected.
 - The same case with travel in 5 days is CRITICAL.
 - A case in 'needs_info' that has been silent means the customer never replied — chase it if travel is near, let it sit if far.
 - 'escalated_to_human' that is still stale means a human dropped it — notify.
 - 'in_fulfillment' going quiet near travel date is the highest concern.

Choose ONE terminal:
 - dispatch_exception: real, actionable problem needing remediation now.
 - notify_operator: worth a human glance, not an automated fix.
 - mark_benign: quiet but expected; no action.

Be decisive and terse. Most far-from-travel cases are benign. Reserve dispatch_exception for genuine time-pressure or stuck states.`;

async function reasonAboutStaleCase(caseCtx: JsonObj): Promise<{ terminal: string; payload: JsonObj; inTok: number; outTok: number; cost: number }> {
  const userMsg = `Stale case flagged. Decide.\n\n${JSON.stringify(caseCtx, null, 2)}`;
  const apiResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: SYSTEM_PROMPT, tools: WATCHDOG_TOOLS, messages: [{ role: "user", content: userMsg }] })
  });
  if (!apiResp.ok) {
    const errText = await apiResp.text();
    throw new Error(`anthropic_api_error ${apiResp.status}: ${errText}`);
  }
  const resp = await apiResp.json();
  const inTok = resp.usage?.input_tokens ?? 0;
  const outTok = resp.usage?.output_tokens ?? 0;
  const cost = (inTok * INPUT_PRICE_PER_M + outTok * OUTPUT_PRICE_PER_M) / 1_000_000;
  const toolUse = (resp.content || []).find((b: JsonObj) => b.type === "tool_use");
  if (!toolUse) return { terminal: "mark_benign", payload: { reason: "no terminal chosen; defaulted benign" }, inTok, outTok, cost };
  return { terminal: toolUse.name as string, payload: (toolUse.input as JsonObj) ?? {}, inTok, outTok, cost };
}

async function dispatchExceptionHandler(caseId: string, problem: string, severity: string, suggestedAction: string | null, watchdogRunId: string): Promise<void> {
  // exception_handler is itself registry-gated; we route through agent_messages
  // AND fire its edge function (fire-and-forget, same pattern as orchestrator).
  await supa.from("agent_messages").insert({
    case_id: caseId, from_agent: "status_watchdog", to_agent: "exception_handler",
    message_type: "dispatch", subject: `Stale-case exception: ${severity}`,
    payload: { problem, severity, suggested_action: suggestedAction }, source_run_id: watchdogRunId, dispatch_state: "pending"
  });
  const url = `${SUPABASE_URL}/functions/v1/exception-handler-agent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    await fetch(url, { method: "POST", headers: { "content-type": "application/json", "authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }, body: JSON.stringify({ case_id: caseId, problem, severity, suggested_action: suggestedAction, watchdog_run_id: watchdogRunId }), signal: controller.signal });
  } catch (_e) { /* fire-and-forget */ } finally { clearTimeout(timer); }
}

Deno.serve(async (req: Request) => {
  const sweepStart = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const triggeredByCase = body.triggered_by_case as string | undefined; // informational

    // Open agent_runs row for the sweep itself (case_id null = portfolio-level).
    const { data: runRow } = await supa.from("agent_runs").insert({
      case_id: triggeredByCase ?? null, agent_name: "status_watchdog", model: MODEL,
      triggered_by: triggeredByCase ? `orchestrator_cycle:${triggeredByCase}` : "manual_sweep",
      state: "running", turn_count: 0, total_input_tokens: 0, total_output_tokens: 0, total_cost_usd: 0
    }).select().single();
    const runId = runRow?.id;

    // ── Deterministic pre-filter: candidate stale cases (cheap SQL) ──
    const { data: openCases } = await supa.from("cases")
      .select("id, case_number, state, assessment_state, target_date, updated_at, origin_country, destination_country")
      .neq("state", "closed")
      .or(`assessment_state.is.null,assessment_state.not.in.(${TERMINAL_STATES.join(",")})`)
      .eq("demo_mode", false);

    const now = Date.now();
    const stale: JsonObj[] = [];
    for (const c of (openCases ?? []) as JsonObj[]) {
      const updatedAt = new Date(c.updated_at as string).getTime();
      const hoursSince = (now - updatedAt) / 3_600_000;
      const daysToTarget = c.target_date ? Math.round((new Date(c.target_date as string).getTime() - now) / 86_400_000) : null;
      const threshold = staleThresholdHours(daysToTarget);
      if (hoursSince >= threshold) {
        stale.push({ ...c, hours_since_update: Math.round(hoursSince), days_to_target: daysToTarget, stale_threshold_hours: threshold });
      }
    }

    // ── Sonnet reasons about each stale case (capped) ──
    const toReason = stale.slice(0, MAX_STALE_CASES_PER_SWEEP);
    let totalIn = 0, totalOut = 0, totalCost = 0;
    const outcomes: JsonObj[] = [];

    for (const sc of toReason) {
      const caseId = sc.id as string;
      // Enrich with latest assessment for context
      const { data: latestAssess } = await supa.from("compliance_assessments")
        .select("verdict, summary, created_at").eq("case_id", caseId).is("superseded_by", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      const ctx = {
        case_number: sc.case_number, state: sc.state, assessment_state: sc.assessment_state,
        corridor: `${sc.origin_country}->${sc.destination_country}`,
        days_since_last_update: Math.round((sc.hours_since_update as number) / 24 * 10) / 10,
        days_until_travel: sc.days_to_target,
        latest_verdict: latestAssess?.verdict ?? null,
        latest_summary: latestAssess?.summary ? (latestAssess.summary as string).slice(0, 400) : null
      };
      try {
        const r = await reasonAboutStaleCase(ctx);
        totalIn += r.inTok; totalOut += r.outTok; totalCost += r.cost;
        if (r.terminal === "dispatch_exception") {
          await dispatchExceptionHandler(caseId, r.payload.problem as string, (r.payload.severity as string) ?? "medium", (r.payload.suggested_action as string) ?? null, runId);
        } else if (r.terminal === "notify_operator") {
          await supa.from("agent_messages").insert({ case_id: caseId, from_agent: "status_watchdog", to_agent: "human_operator", message_type: "notification", subject: `Stale case: ${ctx.case_number}`, payload: { ...r.payload, context: ctx }, source_run_id: runId });
        }
        // mark_benign → no write, just record outcome
        outcomes.push({ case_number: sc.case_number, terminal: r.terminal, severity: r.payload.severity ?? r.payload.note ?? r.payload.reason });
      } catch (e) {
        outcomes.push({ case_number: sc.case_number, terminal: "error", error: String(e) });
      }
    }

    await supa.from("agent_runs").update({
      state: "complete", terminal_tool: "sweep_complete",
      terminal_reason: `swept ${openCases?.length ?? 0} open, ${stale.length} stale, reasoned ${toReason.length}`,
      turn_count: toReason.length, total_input_tokens: totalIn, total_output_tokens: totalOut, total_cost_usd: totalCost,
      completed_at: new Date().toISOString()
    }).eq("id", runId);

    return new Response(JSON.stringify({
      status: "ok", run_id: runId,
      open_cases: openCases?.length ?? 0, stale_detected: stale.length, reasoned: toReason.length,
      outcomes, cost_usd: totalCost, sweep_ms: Date.now() - sweepStart
    }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "watchdog_unhandled", detail: String(e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
});
