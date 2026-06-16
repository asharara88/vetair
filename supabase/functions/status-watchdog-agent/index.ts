// Vetair · status-watchdog-agent v1
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

import {
  AnthropicApiError,
  callAnthropic,
  findToolUses,
  type AnthropicTool,
  type JsonObj,
} from "../_shared/anthropic.ts";
import { fireAndForget, json, jsonError } from "../_shared/http.ts";
import { closeAgentRun, openAgentRun, serviceRoleClient } from "../_shared/supa.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const MODEL = "claude-sonnet-4-6";
const MAX_STALE_CASES_PER_SWEEP = 25; // safety cap on LLM calls per sweep

// Terminal assessment_state values — cases here are done, never stale.
const TERMINAL_STATES = ["rejected", "approved", "conditionally_approved"];

// Staleness thresholds (hours since updated_at) by urgency window to target_date.
// The closer the travel date, the less silence we tolerate.
function staleThresholdHours(daysToTarget: number | null): number {
  if (daysToTarget === null) return 168; // no date: 7 days
  if (daysToTarget <= 7) return 24; //       travel imminent: 1 day
  if (daysToTarget <= 30) return 72; //      within a month: 3 days
  if (daysToTarget <= 90) return 120; //     within a quarter: 5 days
  return 240; //                              far out: 10 days
}

const TOOLS: AnthropicTool[] = [
  {
    name: "dispatch_exception",
    description:
      "TERMINAL. This case has a real, actionable problem. Hand it to the exception_handler agent with a clear problem statement.",
    input_schema: {
      type: "object",
      properties: {
        problem: { type: "string", description: "What is wrong, concretely" },
        severity: { type: "string", enum: ["critical", "high", "medium"] },
        suggested_action: { type: "string" },
      },
      required: ["problem", "severity"],
    },
  },
  {
    name: "notify_operator",
    description:
      "TERMINAL. Worth a human's attention but not an automated exception. Writes a notification.",
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
      "TERMINAL. The case is quiet but that is expected (e.g. far-off travel date, awaiting a known external wait). No action.",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string" } },
      required: ["reason"],
    },
  },
];

const TERMINAL_TOOL_NAMES = TOOLS.map((t) => t.name) as readonly string[];

const SYSTEM_PROMPT =
  `You are the Status Watchdog for Vetair, a pet relocation Multi-Agent System.

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

interface StaleCase extends JsonObj {
  id: string;
  case_number: string;
  state: string;
  assessment_state: string | null;
  target_date: string | null;
  updated_at: string;
  origin_country: string;
  destination_country: string;
  hours_since_update: number;
  days_to_target: number | null;
  stale_threshold_hours: number;
}

interface VerdictResult {
  terminal: string;
  payload: JsonObj;
  inTok: number;
  outTok: number;
  cost: number;
}

async function reasonAboutStaleCase(caseCtx: JsonObj): Promise<VerdictResult> {
  const resp = await callAnthropic(ANTHROPIC_API_KEY, {
    model: MODEL,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    messages: [{ role: "user", content: `Stale case flagged. Decide.\n\n${JSON.stringify(caseCtx, null, 2)}` }],
  });
  const toolUse = findToolUses(resp.content).find((t) =>
    TERMINAL_TOOL_NAMES.includes(t.name as string)
  );
  return {
    terminal: (toolUse?.name as string) ?? "mark_benign",
    payload: ((toolUse?.input as JsonObj) ?? { reason: "no terminal chosen; defaulted benign" }),
    inTok: resp.input_tokens,
    outTok: resp.output_tokens,
    cost: resp.cost_usd,
  };
}

const supa = serviceRoleClient();

async function dispatchExceptionHandler(
  caseId: string,
  payload: JsonObj,
  watchdogRunId: string | null,
): Promise<void> {
  const severity = (payload.severity as string) ?? "medium";
  const problem = payload.problem as string;
  const suggestedAction = (payload.suggested_action as string) ?? null;

  await supa.from("agent_messages").insert({
    case_id: caseId,
    from_agent: "status_watchdog",
    to_agent: "exception_handler",
    message_type: "dispatch",
    subject: `Stale-case exception: ${severity}`,
    payload: { problem, severity, suggested_action: suggestedAction },
    source_run_id: watchdogRunId,
    dispatch_state: "pending",
  });

  await fireAndForget(`${SUPABASE_URL}/functions/v1/exception-handler-agent`, {
    case_id: caseId,
    problem,
    severity,
    suggested_action: suggestedAction,
    watchdog_run_id: watchdogRunId,
  });
}

async function notifyOperator(
  caseId: string,
  caseNumber: string,
  payload: JsonObj,
  ctx: JsonObj,
  runId: string | null,
): Promise<void> {
  await supa.from("agent_messages").insert({
    case_id: caseId,
    from_agent: "status_watchdog",
    to_agent: "human_operator",
    message_type: "notification",
    subject: `Stale case: ${caseNumber}`,
    payload: { ...payload, context: ctx },
    source_run_id: runId,
  });
}

async function findStaleCases(): Promise<{ openCount: number; stale: StaleCase[] }> {
  const { data: openCases } = await supa
    .from("cases")
    .select(
      "id, case_number, state, assessment_state, target_date, updated_at, origin_country, destination_country",
    )
    .neq("state", "closed")
    .or(`assessment_state.is.null,assessment_state.not.in.(${TERMINAL_STATES.join(",")})`)
    .eq("demo_mode", false);

  const now = Date.now();
  const stale: StaleCase[] = [];
  for (const c of (openCases ?? []) as JsonObj[]) {
    const updatedAt = new Date(c.updated_at as string).getTime();
    const hoursSince = (now - updatedAt) / 3_600_000;
    const daysToTarget = c.target_date
      ? Math.round((new Date(c.target_date as string).getTime() - now) / 86_400_000)
      : null;
    const threshold = staleThresholdHours(daysToTarget);
    if (hoursSince >= threshold) {
      stale.push({
        ...(c as StaleCase),
        hours_since_update: Math.round(hoursSince),
        days_to_target: daysToTarget,
        stale_threshold_hours: threshold,
      });
    }
  }
  return { openCount: openCases?.length ?? 0, stale };
}

async function buildCaseContext(sc: StaleCase): Promise<JsonObj> {
  const { data: latestAssess } = await supa
    .from("compliance_assessments")
    .select("verdict, summary, created_at")
    .eq("case_id", sc.id)
    .is("superseded_by", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    case_number: sc.case_number,
    state: sc.state,
    assessment_state: sc.assessment_state,
    corridor: `${sc.origin_country}->${sc.destination_country}`,
    days_since_last_update: Math.round(sc.hours_since_update / 24 * 10) / 10,
    days_until_travel: sc.days_to_target,
    latest_verdict: latestAssess?.verdict ?? null,
    latest_summary: latestAssess?.summary ? (latestAssess.summary as string).slice(0, 400) : null,
  };
}

Deno.serve(async (req: Request) => {
  const sweepStart = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const triggeredByCase = body.triggered_by_case as string | undefined;

    const runId = await openAgentRun(supa, {
      case_id: triggeredByCase ?? null,
      agent_name: "status_watchdog",
      model: MODEL,
      triggered_by: triggeredByCase ? `orchestrator_cycle:${triggeredByCase}` : "manual_sweep",
    });

    const { openCount, stale } = await findStaleCases();
    const toReason = stale.slice(0, MAX_STALE_CASES_PER_SWEEP);

    let totalIn = 0;
    let totalOut = 0;
    let totalCost = 0;
    const outcomes: JsonObj[] = [];

    for (const sc of toReason) {
      const ctx = await buildCaseContext(sc);
      try {
        const r = await reasonAboutStaleCase(ctx);
        totalIn += r.inTok;
        totalOut += r.outTok;
        totalCost += r.cost;

        if (r.terminal === "dispatch_exception") {
          await dispatchExceptionHandler(sc.id, r.payload, runId);
        } else if (r.terminal === "notify_operator") {
          await notifyOperator(sc.id, sc.case_number, r.payload, ctx, runId);
        }
        outcomes.push({
          case_number: sc.case_number,
          terminal: r.terminal,
          severity: r.payload.severity ?? r.payload.note ?? r.payload.reason,
        });
      } catch (e) {
        outcomes.push({ case_number: sc.case_number, terminal: "error", error: String(e) });
      }
    }

    await closeAgentRun(supa, runId, {
      state: "complete",
      terminal_tool: "sweep_complete",
      terminal_reason: `swept ${openCount} open, ${stale.length} stale, reasoned ${toReason.length}`,
      turn_count: toReason.length,
      total_input_tokens: totalIn,
      total_output_tokens: totalOut,
      total_cost_usd: totalCost,
    });

    return json({
      status: "ok",
      run_id: runId,
      open_cases: openCount,
      stale_detected: stale.length,
      reasoned: toReason.length,
      outcomes,
      cost_usd: totalCost,
      sweep_ms: Date.now() - sweepStart,
    });
  } catch (e) {
    const status = e instanceof AnthropicApiError ? 502 : 500;
    return jsonError("watchdog_unhandled", e, status);
  }
});
