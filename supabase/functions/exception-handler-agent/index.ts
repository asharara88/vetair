// Vetair · exception-handler-agent v1
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

import {
  AnthropicApiError,
  callAnthropic,
  findTerminal,
  findToolUses,
  type AnthropicTool,
  type JsonObj,
} from "../_shared/anthropic.ts";
import { json, jsonError } from "../_shared/http.ts";
import {
  closeAgentRun,
  openAgentRun,
  recordTurn,
  serviceRoleClient,
} from "../_shared/supa.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const MODEL = "claude-sonnet-4-6";
const MAX_TURNS = 4;
const MAX_TOOL_RESULT_BYTES = 8000;

const TOOLS: AnthropicTool[] = [
  {
    name: "read_case_state",
    description: "Read full case state before deciding. Call first.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "emit_remediation_plan",
    description:
      "TERMINAL. A concrete fix exists. Records the plan and notifies the operator.",
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
    description:
      "TERMINAL. The issue is a blocked route/cargo path; propose an alternate routing.",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string" }, proposed_route: { type: "string" } },
      required: ["reason", "proposed_route"],
    },
  },
  {
    name: "request_orchestrator_cycle",
    description:
      "TERMINAL. The case just needs the orchestrator to re-evaluate (e.g. new info arrived). Re-enqueue it.",
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
      properties: { reason: { type: "string" }, blocking_issue: { type: "string" } },
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

const TERMINAL_NAMES = [
  "emit_remediation_plan",
  "reroute_corridor",
  "request_orchestrator_cycle",
  "escalate_to_human",
  "fail_exception",
] as const;

const SYSTEM_PROMPT =
  `You are the Exception Handler for Vetair, a pet relocation Multi-Agent System.

A case has hit an exception — flagged by the status watchdog or another agent. You receive the problem statement and severity. Read the case state, then compute the best remediation and choose ONE terminal tool.

PRINCIPLES:
 - Prefer the least-disruptive fix. If the case just needs re-evaluation because info arrived, request_orchestrator_cycle. If the customer simply went quiet, a remediation plan to chase them beats escalation.
 - reroute_corridor only for genuine route/cargo blockages (embargo, cancelled flight, no cargo space).
 - escalate_to_human when money, legal liability, or animal welfare is at stake and no safe automated path exists.
 - During the concierge phase, many "fixes" are a human action (Ahmed or Mohamed books/calls/files). Emit a clear remediation plan listing those concrete steps — that IS the product right now.
 - Never invent capabilities. If a real external system (Stripe, cargo API, MOCCAE portal) is needed but not yet integrated, the remediation plan should name the manual step the operator must take.

Be concrete and terse. Output steps a human can act on today.`;

const supa = serviceRoleClient();

async function readCaseState(caseRow: JsonObj): Promise<JsonObj> {
  const caseId = caseRow.id as string;
  const [owner, pet, latestAssess, latestAudit, recentRuns, recentMsgs] = await Promise.all([
    supa.from("owners").select("full_name, whatsapp_number").eq("id", caseRow.owner_id).maybeSingle(),
    caseRow.pet_id
      ? supa.from("pets").select("name, species, breed").eq("id", caseRow.pet_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supa
      .from("compliance_assessments")
      .select("verdict, summary, requirements_missing, created_at")
      .eq("case_id", caseId)
      .is("superseded_by", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supa
      .from("audit_reviews")
      .select("verdict, reasoning, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supa
      .from("agent_runs")
      .select("agent_name, state, terminal_tool, completed_at")
      .eq("case_id", caseId)
      .order("started_at", { ascending: false })
      .limit(8),
    supa
      .from("agent_messages")
      .select("from_agent, to_agent, subject, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(8),
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
    owner: owner.data,
    pet: pet.data,
    latest_assessment: latestAssess.data,
    latest_audit: latestAudit.data,
    recent_runs: recentRuns.data ?? [],
    recent_messages: recentMsgs.data ?? [],
  };
}

async function handleTool(name: string, caseRow: JsonObj): Promise<JsonObj> {
  if (name === "read_case_state") return readCaseState(caseRow);
  return { error: `unknown non-terminal tool: ${name}` };
}

async function executeTerminal(
  terminal: string,
  payload: JsonObj,
  caseId: string,
  problem: string,
  severity: string,
  runId: string | null,
): Promise<JsonObj> {
  if (terminal === "request_orchestrator_cycle") {
    await supa.from("orchestrator_queue").insert({
      case_id: caseId,
      trigger_event: "exception_handler_reeval",
      trigger_ref: `exception:${runId}`,
      payload: { reason: payload.reason },
      state: "pending",
    });
    return { ok: true, re_enqueued: true };
  }
  if (terminal === "escalate_to_human" || terminal === "fail_exception") {
    await supa.from("cases").update({ assessment_state: "escalated_to_human" }).eq("id", caseId);
    await supa.from("agent_messages").insert({
      case_id: caseId,
      from_agent: "exception_handler",
      to_agent: "human_operator",
      message_type: "notification",
      subject: `Exception escalated: ${problem.slice(0, 60)}`,
      payload: { ...payload, original_problem: problem, severity },
      source_run_id: runId,
    });
    return { ok: true, escalated: true };
  }
  if (terminal === "emit_remediation_plan" || terminal === "reroute_corridor") {
    await supa.from("agent_messages").insert({
      case_id: caseId,
      from_agent: "exception_handler",
      to_agent: "human_operator",
      message_type: "notification",
      subject: `Remediation plan: ${problem.slice(0, 60)}`,
      payload: { ...payload, original_problem: problem, severity, terminal },
      source_run_id: runId,
    });
    return { ok: true, plan_recorded: true };
  }
  return { executed: false };
}

interface RunOutcome {
  terminalTool: string | null;
  terminalPayload: JsonObj | null;
  terminalReason: string | null;
  totalIn: number;
  totalOut: number;
  totalCost: number;
  turnIdx: number;
}

async function runLoop(
  runId: string | null,
  caseRow: JsonObj,
  problem: string,
  severity: string,
  suggestedAction: string | null,
): Promise<RunOutcome> {
  const messages: JsonObj[] = [{
    role: "user",
    content:
      `Exception on this case.\nProblem: ${problem}\nSeverity: ${severity}\nSuggested action (from flagging agent): ${suggestedAction ?? "none"}\n\nBegin with read_case_state, then choose ONE terminal.`,
  }];

  const out: RunOutcome = {
    terminalTool: null,
    terminalPayload: null,
    terminalReason: null,
    totalIn: 0,
    totalOut: 0,
    totalCost: 0,
    turnIdx: 0,
  };

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const resp = await callAnthropic(ANTHROPIC_API_KEY, {
      model: MODEL,
      max_tokens: 1536,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: messages as never,
    });
    out.totalIn += resp.input_tokens;
    out.totalOut += resp.output_tokens;
    out.totalCost += resp.cost_usd;

    if (runId) {
      await recordTurn(supa, {
        run_id: runId,
        turn_index: out.turnIdx,
        kind: "assistant",
        stop_reason: resp.stop_reason,
        content: resp.content,
        tool_calls: findToolUses(resp.content),
        input_tokens: resp.input_tokens,
        output_tokens: resp.output_tokens,
        cost_usd: resp.cost_usd,
        latency_ms: resp.latency_ms,
      });
    }
    messages.push({ role: "assistant", content: resp.content });

    const toolUses = findToolUses(resp.content);
    const terminal = findTerminal(resp.content, TERMINAL_NAMES);
    if (terminal) {
      out.terminalTool = terminal.name as string;
      out.terminalPayload = terminal.input as JsonObj;
      out.terminalReason = `agent_chose_${out.terminalTool}`;
      break;
    }
    if (resp.stop_reason !== "tool_use" || toolUses.length === 0) {
      out.terminalReason = `ended_without_terminal:${resp.stop_reason}`;
      break;
    }

    out.turnIdx += 1;
    const toolResults = await Promise.all(
      toolUses.map(async (tu) => ({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(await handleTool(tu.name as string, caseRow)).slice(
          0,
          MAX_TOOL_RESULT_BYTES,
        ),
      })),
    );
    if (runId) {
      await recordTurn(supa, {
        run_id: runId,
        turn_index: out.turnIdx,
        kind: "tool_result",
        content: toolResults,
      });
    }
    messages.push({ role: "user", content: toolResults });
    out.turnIdx += 1;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  let runId: string | null = null;
  try {
    const body = await req.json();
    const caseId = body.case_id as string | undefined;
    const problem = (body.problem as string) ?? "unspecified exception";
    const severity = (body.severity as string) ?? "medium";
    const suggestedAction = (body.suggested_action as string) ?? null;
    const watchdogRunId = (body.watchdog_run_id as string) ?? null;
    if (!caseId) return jsonError("bad_request", "case_id required", 400);

    const { data: caseRow } = await supa.from("cases").select("*").eq("id", caseId).single();
    if (!caseRow) return jsonError("case_not_found", caseId, 404);
    if (caseRow.demo_mode) return json({ status: "skipped", reason: "demo_mode" });

    runId = await openAgentRun(supa, {
      case_id: caseId,
      agent_name: "exception_handler",
      model: MODEL,
      triggered_by: watchdogRunId ? `watchdog:${watchdogRunId}` : `signal:${severity}`,
    });

    const outcome = await runLoop(runId, caseRow, problem, severity, suggestedAction);

    const terminalResult = outcome.terminalTool
      ? await executeTerminal(
        outcome.terminalTool,
        outcome.terminalPayload ?? {},
        caseId,
        problem,
        severity,
        runId,
      )
      : { executed: false };

    await closeAgentRun(supa, runId, {
      state: outcome.terminalTool ? "complete" : "failed_no_terminal",
      terminal_tool: outcome.terminalTool,
      terminal_reason: outcome.terminalReason,
      turn_count: outcome.turnIdx,
      total_input_tokens: outcome.totalIn,
      total_output_tokens: outcome.totalOut,
      total_cost_usd: outcome.totalCost,
    });

    return json({
      status: "ok",
      run_id: runId,
      terminal_tool: outcome.terminalTool,
      terminal_payload: outcome.terminalPayload,
      terminal_result: terminalResult,
      cost_usd: outcome.totalCost,
    });
  } catch (e) {
    if (e instanceof AnthropicApiError) {
      await closeAgentRun(supa, runId, {
        state: "failed",
        terminal_tool: null,
        terminal_reason: "anthropic_api_error",
        turn_count: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_cost_usd: 0,
        error_message: e.message,
      });
      return jsonError("anthropic_api_error", e.detail, 502);
    }
    return jsonError("exception_handler_unhandled", e, 500);
  }
});
