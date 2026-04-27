// Intake agent — agent #1.
//
// Conversational intake over WhatsApp. Asks ONE question at a time. Captures:
//   - owner profile (name, residence + destination country, target travel window)
//   - pet profile (name, species, breed, DOB, weight, microchip)
//
// Returns a structured "next message" plus partial profile updates. The Comms
// agent is responsible for the actual WhatsApp send — Intake just decides
// what to say.

import "server-only";
import type { AgentContext, AgentMeta, AgentResult } from "./types";
import { callClaude, parseJson } from "./anthropic";
import { renderPrompt } from "./prompt";
import { modelFor } from "./models";
import { recordAgentRun } from "./log";

export const meta: AgentMeta = {
  name: "intake_agent",
  description: "One-question-per-turn conversational intake on WhatsApp.",
  default_model: modelFor("intake_agent"),
  input_budget_tokens: 8_000,
};

export interface IntakeUpdate {
  owner?: {
    full_name?: string;
    residence_country?: string;
    destination_country?: string;
  };
  pet?: {
    name?: string;
    species?: string;
    breed?: string;
    date_of_birth?: string;
    weight_kg?: number;
    microchip_id?: string;
  };
  case?: {
    target_date?: string;
  };
}

export interface IntakeOutput {
  next_message: string;       // body to send to owner via comms_agent
  intake_complete: boolean;   // true once all required fields are captured
  updates: IntakeUpdate;      // diff to apply to owner/pet/case rows
  rationale: string;
}

export async function run(ctx: AgentContext): Promise<AgentResult<IntakeOutput>> {
  const started = Date.now();
  const lastInbound = ctx.payload?.last_inbound as string | undefined;

  // Snapshot the current state of owner + pet + case so the model can decide
  // what's still missing.
  const { data: caseRow } = await ctx.supabase
    .from("cases")
    .select("id, target_date, origin_country, destination_country, owner_id, pet_id")
    .eq("id", ctx.case_id)
    .single();

  if (!caseRow) {
    return await fail(ctx, "case not found", started);
  }

  const [{ data: owner }, { data: pet }] = await Promise.all([
    ctx.supabase.from("owners").select("*").eq("id", caseRow.owner_id).single(),
    ctx.supabase.from("pets").select("*").eq("id", caseRow.pet_id).single(),
  ]);

  const system = renderPrompt("intake", { case_id: ctx.case_id });
  const user = JSON.stringify({
    last_owner_message: lastInbound ?? null,
    owner_known: owner ?? null,
    pet_known: pet ?? null,
    case_known: caseRow,
  });

  const call = await callClaude({
    model: meta.default_model,
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: 800,
    temperature: 0.4,
  });

  if (!call.ok) {
    return await fail(ctx, call.error, started, call.latency_ms);
  }

  const parsed = parseJson<IntakeOutput>(call.text);
  if (!parsed) {
    return await fail(ctx, `intake returned non-JSON: ${call.text.slice(0, 200)}`, started, call.latency_ms);
  }

  const result: AgentResult<IntakeOutput> = {
    ok: true,
    output: parsed,
    decision_summary: parsed.rationale.slice(0, 500),
    confidence: parsed.intake_complete ? 0.95 : 0.85,
    citations: [],
    model: call.response.model,
    input_tokens: call.response.usage.input_tokens,
    output_tokens: call.response.usage.output_tokens,
    cost_usd: call.cost_usd,
    latency_ms: call.latency_ms,
  };
  await recordAgentRun(ctx.supabase, "intake_agent", ctx.case_id, result, {
    input_payload: { last_inbound: lastInbound, owner: owner ?? null, pet: pet ?? null },
    output_payload: parsed,
  });
  return result;
}

async function fail(
  ctx: AgentContext,
  error: string,
  started: number,
  latency_ms?: number,
): Promise<AgentResult<IntakeOutput>> {
  const result: AgentResult<IntakeOutput> = {
    ok: false,
    decision_summary: `Intake failed: ${error}`,
    confidence: 0,
    citations: [],
    latency_ms: latency_ms ?? Date.now() - started,
    error,
  };
  await recordAgentRun(ctx.supabase, "intake_agent", ctx.case_id, result);
  return result;
}
