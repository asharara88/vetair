// Endorsement agent — agent #7.
//
// Owns the 7-10 day pre-flight endorsement window: schedules the OV / USDA /
// MOCCAE submission, files the import permit application, and tracks courier
// delivery of the original endorsed certificate to the destination.

import "server-only";
import type { AgentContext, AgentMeta, AgentResult } from "./types";
import { callClaude, parseJson } from "./anthropic";
import { renderPrompt } from "./prompt";
import { modelFor } from "./models";
import { recordAgentRun } from "./log";

export const meta: AgentMeta = {
  name: "endorsement_agent",
  description: "Schedules MOCCAE/APHA endorsement window; tracks courier delivery.",
  default_model: modelFor("endorsement_agent"),
  input_budget_tokens: 8_000,
};

export interface EndorsementProposal {
  endorsement_authority: "MOCCAE" | "APHA" | "USDA" | "OTHER";
  ov_exam_date: string;          // YYYY-MM-DD; 7-10 days before flight
  submission_date: string;       // YYYY-MM-DD; same day or next-day after OV exam
  expected_endorsement_date: string;
  courier_required: boolean;
  courier_eta_destination: string | null;
  rationale: string;
}

export async function run(ctx: AgentContext): Promise<AgentResult<EndorsementProposal>> {
  const started = Date.now();
  const { data: caseRow } = await ctx.supabase
    .from("cases")
    .select("id, origin_country, destination_country, target_date, earliest_legal_departure")
    .eq("id", ctx.case_id)
    .single();
  if (!caseRow) return fail(ctx, "case not found", started);

  const proposedFlightDate = (ctx.payload?.proposed_flight_date as string | undefined) ?? caseRow.target_date;

  const system = renderPrompt("endorsement", { case_id: ctx.case_id });
  const user = JSON.stringify({ case: caseRow, proposed_flight_date: proposedFlightDate });

  const call = await callClaude({
    model: meta.default_model,
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: 1_200,
    temperature: 0,
  });
  if (!call.ok) return fail(ctx, call.error, started, call.latency_ms);

  const parsed = parseJson<EndorsementProposal>(call.text);
  if (!parsed) return fail(ctx, `non-JSON from endorsement: ${call.text.slice(0, 200)}`, started, call.latency_ms);

  const result: AgentResult<EndorsementProposal> = {
    ok: true,
    output: parsed,
    decision_summary: parsed.rationale.slice(0, 500),
    confidence: 0.9,
    citations: [],
    model: call.response.model,
    input_tokens: call.response.usage.input_tokens,
    output_tokens: call.response.usage.output_tokens,
    cost_usd: call.cost_usd,
    latency_ms: call.latency_ms,
  };
  await recordAgentRun(ctx.supabase, "endorsement_agent", ctx.case_id, result, {
    output_payload: parsed,
  });
  return result;
}

async function fail(
  ctx: AgentContext,
  error: string,
  started: number,
  latency_ms?: number,
): Promise<AgentResult<EndorsementProposal>> {
  const result: AgentResult<EndorsementProposal> = {
    ok: false,
    decision_summary: `Endorsement failed: ${error}`,
    confidence: 0,
    citations: [],
    latency_ms: latency_ms ?? Date.now() - started,
    error,
  };
  await recordAgentRun(ctx.supabase, "endorsement_agent", ctx.case_id, result);
  return result;
}
