// Vetair · exception-handler-agent v1
// Registry contract: lib/agents/exception_handler.ts
// Canonical prompt:  lib/prompts/exception_handler.md
// When you edit SYSTEM_PROMPT below, mirror the change into the markdown.
//
// Fired on signal (from status_watchdog, or any agent that hits an exception).
// Computes a remediation path for a case-level problem and routes it:
//   - reroute_corridor / reschedule  → notification to operator with a concrete plan
//   - request_orchestrator_cycle     → re-enqueue the case so the orchestrator re-evaluates
//   - escalate_to_human              → hand off, stop automated handling
//   - fail_exception                 → could not compute a remediation; log + escalate
//
// Follows orchestrator v9 conventions: agent_runs row per invocation, agent_turns
// logging, agent_messages coordination, demo_mode skip, terminal-tool pattern,
// fail-soft. Registry contract terminal_tools: emit_remediation_plan,
// escalate_to_human, reroute_corridor, fail_exception.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MODEL = "claude-sonnet-4-6";
const MAX_TURNS = 4;
const INPUT_PRICE_PER_M = 3.0;
const OUTPUT_PRICE_PER_M = 15.0;

type JsonObj = Record<string, unknown>;
const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const TOOLS = [
  { name: "read_case_state", description: "Read full case state before deciding. Call first.", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "emit_remediation_plan", description: "TERMINAL. A concrete fix exists. Records the plan and notifies the operator.", input_schema: { type: "object", properties: { plan: { type: "string" }, steps: { type: "array", items: { type: "string" } }, requires_customer_action: { type: "boolean" } }, required: ["plan", "steps"] } },
  { name: "reroute_corridor", description: "TERMINAL. The issue is a blocked route/cargo path; propose an alternate routing.", input_schema: { type: "object", properties: { reason: { type: "string" }, proposed_route: { type: "string" } }, required: ["reason", "proposed_route"] } },
  { name: "request_orchestrator_cycle", description: "TERMINAL. The case just needs the orchestrator to re-evaluate (e.g. new info arrived). Re-enqueue it.", input_schema: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"] } },
  { name: "escalate_to_human", description: "TERMINAL. No automated remediation; a human must intervene.", input_schema: { type: "object", properties: { reason: { type: "string" }, blocking_issue: { type: "string" } }, required: ["reason", "blocking_issue"] } },
  { name: "fail_exception", description: "TERMINAL. Could not compute a remediation. Logs and escalates.", input_schema: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"] } }
];

const SYSTEM_PROMPT = `You are the Exception Handler for Vetair, a pet relocation Multi-Agent System.

A case has hit an exception — flagged by the status watchdog or another agent. You receive the problem statement and severity. Read the case state, then compute the best remediation and choose ONE terminal tool.

PRINCIPLES:
 - Prefer the least-disruptive fix. If the case just needs re-evaluation because info arrived, request_orchestrator_cycle. If the customer simply went quiet, a remediation plan to chase them beats escalation.
 - reroute_corridor only for genuine route/cargo blockages (embargo, cancelled flight, no cargo space).
 - escalate_to_human when money, legal liability, or animal welfare is at stake and no safe automated path exists.
 - During the concierge phase, many "fixes" are a human action (Ahmed or Mohamed books/calls/files). Emit a clear remediation plan listing those concrete steps — that IS the product right now.
 - Never invent capabilities. If a real external system (Stripe, cargo API, MOCCAE portal) is needed but not yet integrated, the remediation plan should name the manual step the operator must take.

Be concrete and terse. Output steps a human can act on today.`;

async function handleTool(name: string, _input: JsonObj, caseRow: JsonObj): Promise<JsonObj> {
  const caseId = caseRow.id as string;
  if (name === "read_case_state") {
    const [ownerR, petR, latestAssessR, latestAuditR, recentRunsR, recentMsgsR] = await Promise.all([
      supa.from("owners").select("full_name, whatsapp_number").eq("id", caseRow.owner_id).maybeSingle(),
      caseRow.pet_id ? supa.from("pets").select("name, species, breed").eq("id", caseRow.pet_id).maybeSingle() : Promise.resolve({ data: null }),
      supa.from("compliance_assessments").select("verdict, summary, requirements_missing, created_at").eq("case_id", caseId).is("superseded_by", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supa.from("audit_reviews").select("verdict, reasoning, created_at").eq("case_id", caseId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supa.from("agent_runs").select("agent_name, state, terminal_tool, completed_at").eq("case_id", caseId).order("started_at", { ascending: false }).limit(8),
      supa.from("agent_messages").select("from_agent, to_agent, subject, created_at").eq("case_id", caseId).order("created_at", { ascending: false }).limit(8)
    ]);
    return {
      case: { id: caseRow.id, case_number: caseRow.case_number, corridor: `${caseRow.origin_country}->${caseRow.destination_country}`, state: caseRow.state, assessment_state: caseRow.assessment_state, target_date: caseRow.target_date, updated_at: caseRow.updated_at },
      owner: ownerR.data, pet: petR.data,
      latest_assessment: latestAssessR.data, latest_audit: latestAuditR.data,
      recent_runs: recentRunsR.data ?? [], recent_messages: recentMsgsR.data ?? []
    };
  }
  return { error: `unknown non-terminal tool: ${name}` };
}

Deno.serve(async (req: Request) => {
  try {
    const body = await req.json();
    const caseId = body.case_id as string | undefined;
    const problem = (body.problem as string) ?? "unspecified exception";
    const severity = (body.severity as string) ?? "medium";
    const suggestedAction = (body.suggested_action as string) ?? null;
    const watchdogRunId = (body.watchdog_run_id as string) ?? null;
    if (!caseId) return new Response(JSON.stringify({ error: "case_id required" }), { status: 400, headers: { "content-type": "application/json" } });

    const { data: caseRow } = await supa.from("cases").select("*").eq("id", caseId).single();
    if (!caseRow) return new Response(JSON.stringify({ error: "case_not_found" }), { status: 404, headers: { "content-type": "application/json" } });
    if (caseRow.demo_mode) return new Response(JSON.stringify({ status: "skipped", reason: "demo_mode" }), { headers: { "content-type": "application/json" } });

    const { data: runRow } = await supa.from("agent_runs").insert({
      case_id: caseId, agent_name: "exception_handler", model: MODEL,
      triggered_by: watchdogRunId ? `watchdog:${watchdogRunId}` : `signal:${severity}`,
      state: "running", turn_count: 0, total_input_tokens: 0, total_output_tokens: 0, total_cost_usd: 0
    }).select().single();
    const runId = runRow?.id;

    const messages: JsonObj[] = [{ role: "user", content: `Exception on this case.\nProblem: ${problem}\nSeverity: ${severity}\nSuggested action (from flagging agent): ${suggestedAction ?? "none"}\n\nBegin with read_case_state, then choose ONE terminal.` }];
    let terminalTool: string | null = null, terminalPayload: JsonObj | null = null, terminalReason: string | null = null;
    let totalIn = 0, totalOut = 0, totalCost = 0, turnIdx = 0;

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const t0 = Date.now();
      const apiResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: MODEL, max_tokens: 1536, system: SYSTEM_PROMPT, tools: TOOLS, messages })
      });
      const latencyMs = Date.now() - t0;
      if (!apiResp.ok) {
        const errText = await apiResp.text();
        await supa.from("agent_runs").update({ state: "failed", error_message: `API ${apiResp.status}: ${errText}`, completed_at: new Date().toISOString() }).eq("id", runId);
        return new Response(JSON.stringify({ error: "anthropic_api_error", detail: errText }), { status: 502, headers: { "content-type": "application/json" } });
      }
      const resp = await apiResp.json();
      const inTok = resp.usage?.input_tokens ?? 0, outTok = resp.usage?.output_tokens ?? 0;
      const turnCost = (inTok * INPUT_PRICE_PER_M + outTok * OUTPUT_PRICE_PER_M) / 1_000_000;
      totalIn += inTok; totalOut += outTok; totalCost += turnCost;
      await supa.from("agent_turns").insert({ run_id: runId, turn_index: turnIdx, kind: "assistant", stop_reason: resp.stop_reason, content: resp.content, tool_calls: (resp.content || []).filter((b: JsonObj) => b.type === "tool_use"), input_tokens: inTok, output_tokens: outTok, cost_usd: turnCost, latency_ms: latencyMs });
      messages.push({ role: "assistant", content: resp.content });
      const toolUses = (resp.content || []).filter((b: JsonObj) => b.type === "tool_use");
      const terminals = ["emit_remediation_plan", "reroute_corridor", "request_orchestrator_cycle", "escalate_to_human", "fail_exception"];
      const terminalCall = toolUses.find((t: JsonObj) => terminals.includes(t.name as string));
      if (terminalCall) { terminalTool = terminalCall.name as string; terminalPayload = terminalCall.input as JsonObj; terminalReason = `agent_chose_${terminalTool}`; break; }
      if (resp.stop_reason !== "tool_use" || toolUses.length === 0) { terminalReason = `ended_without_terminal:${resp.stop_reason}`; break; }
      turnIdx += 1;
      const toolResults = await Promise.all(toolUses.map(async (tu: JsonObj) => ({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(await handleTool(tu.name as string, (tu.input as JsonObj) ?? {}, caseRow)).slice(0, 8000) })));
      await supa.from("agent_turns").insert({ run_id: runId, turn_index: turnIdx, kind: "tool_result", content: toolResults });
      messages.push({ role: "user", content: toolResults }); turnIdx += 1;
    }

    // Execute terminal
    let terminalResult: JsonObj = { executed: false };
    if (terminalTool === "request_orchestrator_cycle") {
      await supa.from("orchestrator_queue").insert({ case_id: caseId, trigger_event: "exception_handler_reeval", trigger_ref: `exception:${runId}`, payload: { reason: terminalPayload?.reason }, state: "pending" });
      terminalResult = { ok: true, re_enqueued: true };
    } else if (terminalTool === "escalate_to_human" || terminalTool === "fail_exception") {
      await supa.from("cases").update({ assessment_state: "escalated_to_human" }).eq("id", caseId);
      await supa.from("agent_messages").insert({ case_id: caseId, from_agent: "exception_handler", to_agent: "human_operator", message_type: "notification", subject: `Exception escalated: ${problem.slice(0, 60)}`, payload: { ...terminalPayload, original_problem: problem, severity }, source_run_id: runId });
      terminalResult = { ok: true, escalated: true };
    } else if (terminalTool === "emit_remediation_plan" || terminalTool === "reroute_corridor") {
      await supa.from("agent_messages").insert({ case_id: caseId, from_agent: "exception_handler", to_agent: "human_operator", message_type: "notification", subject: `Remediation plan: ${problem.slice(0, 60)}`, payload: { ...terminalPayload, original_problem: problem, severity, terminal: terminalTool }, source_run_id: runId });
      terminalResult = { ok: true, plan_recorded: true };
    }

    await supa.from("agent_runs").update({ state: terminalTool ? "complete" : "failed_no_terminal", terminal_tool: terminalTool, terminal_reason: terminalReason, turn_count: turnIdx, total_input_tokens: totalIn, total_output_tokens: totalOut, total_cost_usd: totalCost, completed_at: new Date().toISOString() }).eq("id", runId);

    return new Response(JSON.stringify({ status: "ok", run_id: runId, terminal_tool: terminalTool, terminal_payload: terminalPayload, terminal_result: terminalResult, cost_usd: totalCost }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "exception_handler_unhandled", detail: String(e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
});
