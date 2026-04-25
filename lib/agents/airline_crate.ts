// Airline & Crate agent — agent #6.
//
// Selects an IATA-compliant route + airline + crate size (CR-82 spec) for
// the pet. Honours summer/winter temperature embargos (e.g. snub-nose
// breeds, ambient temp limits at hub airports).
//
// Returns a proposal that the consensus timeline loop reconciles with vet
// + endorsement timing.

import "server-only";
import type { AgentContext, AgentMeta, AgentResult } from "./types";
import { callClaude, parseJson } from "./anthropic";
import { renderPrompt } from "./prompt";
import { modelFor } from "./models";
import { recordAgentRun } from "./log";

export const meta: AgentMeta = {
  name: "airline_crate_agent",
  description: "Selects IATA-compliant route, airline, and crate. Honours temperature embargos.",
  default_model: modelFor("airline_crate_agent"),
  input_budget_tokens: 12_000,
};

export interface CrateSpec {
  iata_size: string;     // e.g. "M2", "L1"
  external_l_cm: number;
  external_w_cm: number;
  external_h_cm: number;
  notes: string;
}

export interface AirlineProposal {
  route: { origin_iata: string; via_iata: string | null; destination_iata: string };
  airline: { name: string; iata_code: string; live_animal_category: "pets_in_cabin" | "checked" | "manifest_cargo" };
  crate: CrateSpec;
  proposed_flight_date: string; // YYYY-MM-DD
  embargo_notes: string[];
  rationale: string;
}

export async function run(ctx: AgentContext): Promise<AgentResult<AirlineProposal>> {
  const started = Date.now();
  const { data: caseRow } = await ctx.supabase
    .from("cases")
    .select("id, origin_country, destination_country, target_date, earliest_legal_departure, pet_id")
    .eq("id", ctx.case_id)
    .single();
  if (!caseRow) return fail(ctx, "case not found", started);

  const { data: pet } = await ctx.supabase.from("pets").select("*").eq("id", caseRow.pet_id).single();

  const system = renderPrompt("airline_crate", { case_id: ctx.case_id });
  const user = JSON.stringify({ case: caseRow, pet });

  const call = await callClaude({
    model: meta.default_model,
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: 1_500,
    temperature: 0.1,
  });
  if (!call.ok) return fail(ctx, call.error, started, call.latency_ms);

  const parsed = parseJson<AirlineProposal>(call.text);
  if (!parsed) return fail(ctx, `non-JSON from airline_crate: ${call.text.slice(0, 200)}`, started, call.latency_ms);

  const result: AgentResult<AirlineProposal> = {
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
  await recordAgentRun(ctx.supabase, "airline_crate_agent", ctx.case_id, result, {
    output_payload: parsed,
  });
  return result;
}

async function fail(
  ctx: AgentContext,
  error: string,
  started: number,
  latency_ms?: number,
): Promise<AgentResult<AirlineProposal>> {
  const result: AgentResult<AirlineProposal> = {
    ok: false,
    decision_summary: `Airline & Crate failed: ${error}`,
    confidence: 0,
    citations: [],
    latency_ms: latency_ms ?? Date.now() - started,
    error,
  };
  await recordAgentRun(ctx.supabase, "airline_crate_agent", ctx.case_id, result);
  return result;
}
