// Vet Network agent — agent #5.
//
// Matches the owner to an approved vet near their residence and proposes
// appointment dates for: microchip implant (if needed), rabies vaccine,
// rabies titer (export-only corridors), and OV/USDA endorsement.
//
// Returns a proposal — the consensus timeline loop in the orchestrator
// reconciles this with Airline & Crate and Endorsement before locking dates.

import "server-only";
import type { AgentContext, AgentMeta, AgentResult } from "./types";
import { callClaude, parseJson } from "./anthropic";
import { renderPrompt } from "./prompt";
import { modelFor } from "./models";
import { recordAgentRun } from "./log";

export const meta: AgentMeta = {
  name: "vet_network_agent",
  description: "Matches owner to approved vet; proposes microchip/vaccine/titer/endorsement dates.",
  default_model: modelFor("vet_network_agent"),
  input_budget_tokens: 8_000,
};

export interface VetProposal {
  vet_clinic: { name: string; city: string; country: string; license_id: string | null };
  appointments: Array<{
    procedure: "microchip_implant" | "rabies_vaccine" | "rabies_titer" | "endorsement_exam" | "health_certificate";
    proposed_date: string; // YYYY-MM-DD
    required_by: string | null;
    rationale: string;
  }>;
  rationale: string;
}

export async function run(ctx: AgentContext): Promise<AgentResult<VetProposal>> {
  const started = Date.now();
  const { data: caseRow } = await ctx.supabase
    .from("cases")
    .select("id, origin_country, destination_country, target_date, earliest_legal_departure, pet_id, owner_id")
    .eq("id", ctx.case_id)
    .single();
  if (!caseRow) return fail(ctx, "case not found", started);

  const [{ data: pet }, { data: owner }] = await Promise.all([
    ctx.supabase.from("pets").select("*").eq("id", caseRow.pet_id).single(),
    ctx.supabase.from("owners").select("*").eq("id", caseRow.owner_id).single(),
  ]);

  const system = renderPrompt("vet_network", { case_id: ctx.case_id });
  const user = JSON.stringify({ case: caseRow, pet, owner });

  const call = await callClaude({
    model: meta.default_model,
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: 1_500,
    temperature: 0.2,
  });
  if (!call.ok) return fail(ctx, call.error, started, call.latency_ms);

  const parsed = parseJson<VetProposal>(call.text);
  if (!parsed) return fail(ctx, `non-JSON from vet_network: ${call.text.slice(0, 200)}`, started, call.latency_ms);

  const result: AgentResult<VetProposal> = {
    ok: true,
    output: parsed,
    decision_summary: parsed.rationale.slice(0, 500),
    confidence: 0.85,
    citations: [],
    model: call.response.model,
    input_tokens: call.response.usage.input_tokens,
    output_tokens: call.response.usage.output_tokens,
    cost_usd: call.cost_usd,
    latency_ms: call.latency_ms,
  };
  await recordAgentRun(ctx.supabase, "vet_network_agent", ctx.case_id, result, {
    output_payload: parsed,
  });
  return result;
}

async function fail(
  ctx: AgentContext,
  error: string,
  started: number,
  latency_ms?: number,
): Promise<AgentResult<VetProposal>> {
  const result: AgentResult<VetProposal> = {
    ok: false,
    decision_summary: `Vet network failed: ${error}`,
    confidence: 0,
    citations: [],
    latency_ms: latency_ms ?? Date.now() - started,
    error,
  };
  await recordAgentRun(ctx.supabase, "vet_network_agent", ctx.case_id, result);
  return result;
}
