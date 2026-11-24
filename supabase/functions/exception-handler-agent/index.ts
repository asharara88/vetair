// Vetair · exception-handler-agent v1
// Fired on signal (from status_watchdog, or any agent that hits an exception).
// Computes a remediation path for a case-level problem and routes it:
//   - reroute_corridor / emit_remediation_plan → notification to operator with a concrete plan
//   - request_orchestrator_cycle               → re-enqueue the case so the orchestrator re-evaluates
//   - escalate_to_human                        → hand off, stop automated handling
//   - fail_exception                           → could not compute a remediation; log + escalate
//
// Follows orchestrator v9 conventions: agent_runs row per invocation, agent_turns
// logging, agent_messages coordination, demo_mode skip, terminal-tool pattern,
// fail-soft.

import {
  type JsonObj,
  anthropicChat,
  AnthropicError,
  closeRun,
  clipToolResult,
  jsonResponse,
  openRun,
  supaClient,
  tokenCost,
  toolUses,
} from "../_shared/agent-runtime.ts";

const MODEL = "claude-sonnet-4-6";
const MAX_TURNS = 4;

const TERMINAL_TOOLS = new Set([
  "emit_remediation_plan",
  "reroute_corridor",
  "request_orchestrator_cycle",
  "escalate_to_human",
  "fail_exception",
]);

const TOOLS = [
  {
    name: "read_case_state",
    description: "Read full case state before deciding. Call first.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "emit_remediation_plan",
    description: "TERMINAL. A concrete fix exists. Records the plan and notifies the operator.",
    input_schema: {
      type: "object",
      properties: {
        plan: { type: "string" },
        steps: { type: "array", items: { type: "string" } },
        requires_customer_action: { type: "boolean" },
      },
      required: ["plan", "steps"],
    },
  },
  {
    name: "reroute_corridor",
    description: "TERMINAL. The issue is a blocked route/cargo path; propose an alternate routing.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string" },
        proposed_route: { type: "string" },
      },
      required: ["reason", "proposed_route"],
    },
  },
  {
    name: "request_orchestrator_cycle",
    description: "TERMINAL. The case just needs the orchestrator to re-evaluate (e.g. new info arrived). Re-enqueue it.",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string" } },
      required: ["reason"],
    },
  },
  {
    name: "escalate_to_human",
    description: "TERMINAL. No automated remediation; a human must intervene.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string" },
        blocking_issue: { type: "string" },
      },
      required: ["reason", "blocking_issue"],
    },
  },
  {
    name: "fail_exception",
    description: "TERMINAL. Could not compute a remediation. Logs and escalates.",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string" } },
      required: ["reason"],
    },
  },
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

const supa = supaClient();

async function readCaseState(caseRow: JsonObj): Promise<JsonObj> {
  const caseId = caseRow.id as string;
  const [ownerR, petR, latestAssessR, latestAuditR, recentRunsR, recentMsgsR] = await Promise.all([
    supa.from("owners").select("full_name, whatsapp_number").eq("id", caseRow.owner_id).maybeSingle(),
    caseRow.pet_id
      ? supa.from("pets").select("name, species, breed").eq("id", caseRow.pet_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supa.from("compliance_assessments")
      .select("verdict, summary, requirements_missing, created_at")
      .eq("case_id", caseId).is("superseded_by", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supa.from("audit_reviews")
      .select("verdict, reasoning, created_at").eq("case_id", caseId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supa.from("agent_runs")
      .select("agent_name, state, terminal_tool, completed_at").eq("case_id", caseId)
      .order("started_at", { ascending: false }).limit(8),
    supa.from("agent_messages")
      .select("from_agent, to_agent, subject, created_at").eq("case_id", caseId)
      .order("created_at", { ascending: false }).limit(8),
  ]);
  return {
    case: {
      id: caseRow.id,
      case_number: caseRow.case_number,
      corridor: `${caseRow.origin_country}->${caseRow.destination_country}`,
      state: caseRow.state,
      assessment_state: caseRow.assessment_state,
      target_date: caseRow.target_date,
      updated_at: caseRow.updated_at,
    },
    owner: ownerR.data,
    pet: petR.data,
    latest_assessment: latestAssessR.data,
    latest_audit: latestAuditR.data,
    recent_runs: recentRunsR.data ?? [],
    recent_messages: recentMsgsR.data ?? [],
  };
}

async function executeTerminal(
  caseId: string,
  runId: string,
  terminalTool: string,
  terminalPayload: JsonObj,
  problem: string,
  severity: string,
): Promise<JsonObj> {
  if (terminalTool === "request_orchestrator_cycle") {
    await supa.from("orchestrator_queue").insert({
      case_id: caseId,
      trigger_event: "exception_handler_reeval",
      trigger_ref: `exception:${runId}`,
      payload: { reason: terminalPayload.reason },
      state: "pending",
    });
    return { ok: true, re_enqueued: true };
  }
  if (terminalTool === "escalate_to_human" || terminalTool === "fail_exception") {
    await supa.from("cases").update({ assessment_state: "escalated_to_human" }).eq("id", caseId);
    await supa.from("agent_messages").insert({
      case_id: caseId,
      from_agent: "exception_handler",
      to_agent: "human_operator",
      message_type: "notification",
      subject: `Exception escalated: ${problem.slice(0, 60)}`,
      payload: { ...terminalPayload, original_problem: problem, severity },
      source_run_id: runId,
    });
    return { ok: true, escalated: true };
  }
  if (terminalTool === "emit_remediation_plan" || terminalTool === "reroute_corridor") {
    await supa.from("agent_messages").insert({
      case_id: caseId,
      from_agent: "exception_handler",
      to_agent: "human_operator",
      message_type: "notification",
      subject: `Remediation plan: ${problem.slice(0, 60)}`,
      payload: { ...terminalPayload, original_problem: problem, severity, terminal: terminalTool },
      source_run_id: runId,
    });
    return { ok: true, plan_recorded: true };
  }
  return { executed: false };
}

Deno.serve(async (req: Request) => {
  try {
    const body = await req.json();
    const caseId = body.case_id as string | undefined;
    const problem = (body.problem as string) ?? "unspecified exception";
    const severity = (body.severity as string) ?? "medium";
    const suggestedAction = (body.suggested_action as string) ?? null;
    const watchdogRunId = (body.watchdog_run_id as string) ?? null;
    if (!caseId) return jsonResponse({ error: "case_id required" }, 400);

    const { data: caseRow } = await supa.from("cases").select("*").eq("id", caseId).single();
    if (!caseRow) return jsonResponse({ error: "case_not_found" }, 404);
    if (caseRow.demo_mode) return jsonResponse({ status: "skipped", reason: "demo_mode" });

    const runId = await openRun(supa, {
      case_id: caseId,
      agent_name: "exception_handler",
      model: MODEL,
      triggered_by: watchdogRunId ? `watchdog:${watchdogRunId}` : `signal:${severity}`,
    });
    if (!runId) return jsonResponse({ error: "run_insert_failed" }, 500);

    const messages: JsonObj[] = [{
      role: "user",
      content: `Exception on this case.\nProblem: ${problem}\nSeverity: ${severity}\nSuggested action (from flagging agent): ${suggestedAction ?? "none"}\n\nBegin with read_case_state, then choose ONE terminal.`,
    }];

    let terminalTool: string | null = null;
    let terminalPayload: JsonObj | null = null;
    let terminalReason: string | null = null;
    let totalIn = 0, totalOut = 0, totalCost = 0, turnIdx = 0;

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const t0 = Date.now();
      let resp;
      try {
        resp = await anthropicChat({ model: MODEL, system: SYSTEM_PROMPT, tools: TOOLS, messages, max_tokens: 1536 });
      } catch (e) {
        const detail = e instanceof AnthropicError ? e.body : String(e);
        await closeRun(supa, {
          run_id: runId,
          state: "failed",
          error_message: `anthropic_api_error: ${detail}`,
          turn_count: turnIdx,
          total_input_tokens: totalIn,
          total_output_tokens: totalOut,
          total_cost_usd: totalCost,
        });
        return jsonResponse({ error: "anthropic_api_error", detail }, 502);
      }
      const latencyMs = Date.now() - t0;
      const turnCost = tokenCost(MODEL, resp.usage.input_tokens, resp.usage.output_tokens);
      totalIn += resp.usage.input_tokens;
      totalOut += resp.usage.output_tokens;
      totalCost += turnCost;

      await supa.from("agent_turns").insert({
        run_id: runId,
        turn_index: turnIdx,
        kind: "assistant",
        stop_reason: resp.stop_reason,
        content: resp.content,
        tool_calls: toolUses(resp),
        input_tokens: resp.usage.input_tokens,
        output_tokens: resp.usage.output_tokens,
        cost_usd: turnCost,
        latency_ms: latencyMs,
      });
      messages.push({ role: "assistant", content: resp.content });

      const uses = toolUses(resp);
      const terminalCall = uses.find((t) => t.name && TERMINAL_TOOLS.has(t.name));
      if (terminalCall) {
        terminalTool = terminalCall.name!;
        terminalPayload = terminalCall.input ?? {};
        terminalReason = `agent_chose_${terminalTool}`;
        break;
      }
      if (resp.stop_reason !== "tool_use" || uses.length === 0) {
        terminalReason = `ended_without_terminal:${resp.stop_reason}`;
        break;
      }

      turnIdx += 1;
      const toolResults = await Promise.all(uses.map(async (tu) => {
        const result = tu.name === "read_case_state"
          ? await readCaseState(caseRow)
          : { error: `unknown non-terminal tool: ${tu.name}` };
        return { type: "tool_result", tool_use_id: tu.id, content: clipToolResult(result) };
      }));
      await supa.from("agent_turns").insert({ run_id: runId, turn_index: turnIdx, kind: "tool_result", content: toolResults });
      messages.push({ role: "user", content: toolResults });
      turnIdx += 1;
    }

    if (!terminalReason) terminalReason = "budget_exhausted";

    let terminalResult: JsonObj = { executed: false };
    if (terminalTool && terminalPayload) {
      terminalResult = await executeTerminal(caseId, runId, terminalTool, terminalPayload, problem, severity);
    }

    await closeRun(supa, {
      run_id: runId,
      state: terminalTool ? "complete" : "failed_no_terminal",
      terminal_tool: terminalTool,
      terminal_reason: terminalReason,
      turn_count: turnIdx,
      total_input_tokens: totalIn,
      total_output_tokens: totalOut,
      total_cost_usd: totalCost,
    });

    return jsonResponse({
      status: "ok",
      run_id: runId,
      terminal_tool: terminalTool,
      terminal_payload: terminalPayload,
      terminal_result: terminalResult,
      cost_usd: totalCost,
    });
  } catch (e) {
    return jsonResponse({ error: "exception_handler_unhandled", detail: String(e) }, 500);
  }
});
