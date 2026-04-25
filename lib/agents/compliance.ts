// Compliance Primary — agent #3 / voice 2 of the three-voice spine.
//
// Reasons over case + rules and returns a verdict with citations. The
// deterministic engine and the Auditor are the other two voices; consensus is
// resolved by the compliance-evaluate edge function.
//
// In practice this module is a Node-runtime fallback for when we run the
// three-voice flow from Next.js (e.g. server actions) instead of from the
// edge function. The edge function calls the same prompts inline.

import "server-only";
import type { AgentContext, AgentMeta, AgentResult, Citation } from "./types";
import { callClaude, parseJson } from "./anthropic";
import { renderPrompt } from "./prompt";
import { modelFor } from "./models";
import { recordAgentRun } from "./log";

export const meta: AgentMeta = {
  name: "compliance_primary",
  description: "Primary compliance voice. Reasons over case + rules; cites requirement_codes.",
  default_model: modelFor("compliance_primary"),
  input_budget_tokens: 32_000,
};

export type Verdict = "approved" | "blocked" | "pending";

export interface ComplianceOutput {
  verdict: Verdict;
  earliest_legal_departure: string | null;
  rationale: string;
  per_rule: Array<{
    requirement_code: string;
    status: "satisfied" | "pending" | "blocked" | "not_applicable";
    notes: string;
  }>;
}

export async function run(ctx: AgentContext): Promise<AgentResult<ComplianceOutput>> {
  const started = Date.now();
  const { case_id } = ctx;

  const { data: caseRow, error: caseErr } = await ctx.supabase
    .from("cases")
    .select("id, origin_country, destination_country, target_date, pet_id")
    .eq("id", case_id)
    .single();
  if (caseErr || !caseRow) return fail(ctx, `case ${case_id} not found`, started);

  const { data: pet } = await ctx.supabase.from("pets").select("*").eq("id", caseRow.pet_id).single();
  const { data: docs } = await ctx.supabase.from("documents").select("*").eq("case_id", case_id);
  const { data: rules } = await ctx.supabase
    .from("country_rules")
    .select("requirement_code, requirement_type, evidence_schema, time_constraints, priority, source_url")
    .eq("origin_country", caseRow.origin_country)
    .eq("destination_country", caseRow.destination_country)
    .eq("species", pet?.species ?? "dog")
    .eq("is_active", true)
    .order("priority", { ascending: false });

  if (!rules || rules.length === 0) return fail(ctx, "no rules for this corridor+species", started);

  const system = renderPrompt("compliance", { case_id });
  const user = JSON.stringify({ case: caseRow, pet, documents: docs ?? [], rules }, null, 2);

  const call = await callClaude({
    model: meta.default_model,
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: 4_096,
    temperature: 0,
  });
  if (!call.ok) return fail(ctx, call.error, started, call.latency_ms);

  const parsed = parseJson<ComplianceOutput>(call.text);
  if (!parsed) return fail(ctx, `non-JSON from compliance: ${call.text.slice(0, 200)}`, started, call.latency_ms);

  // Reject hallucinated codes — every per_rule entry must reference a real requirement_code.
  const validCodes = new Set(rules.map((r) => r.requirement_code));
  const hallucinated = parsed.per_rule.filter((r) => !validCodes.has(r.requirement_code));
  if (hallucinated.length > 0) {
    return fail(
      ctx,
      `hallucinated requirement codes: ${hallucinated.map((h) => h.requirement_code).join(", ")}`,
      started,
      call.latency_ms,
    );
  }

  const citations: Citation[] = parsed.per_rule.map((p) => ({
    requirement_code: p.requirement_code,
    source_url: rules.find((r) => r.requirement_code === p.requirement_code)?.source_url ?? null,
  }));

  const result: AgentResult<ComplianceOutput> = {
    ok: true,
    output: parsed,
    decision_summary: parsed.rationale.slice(0, 500),
    confidence: parsed.verdict === "pending" ? 0.6 : 0.95,
    citations,
    model: call.response.model,
    input_tokens: call.response.usage.input_tokens,
    output_tokens: call.response.usage.output_tokens,
    cost_usd: call.cost_usd,
    latency_ms: call.latency_ms,
  };
  await recordAgentRun(ctx.supabase, "compliance_primary", case_id, result, {
    input_payload: { rule_count: rules.length, doc_count: docs?.length ?? 0 },
    output_payload: parsed,
  });
  return result;
}

async function fail(
  ctx: AgentContext,
  error: string,
  started: number,
  latency_ms?: number,
): Promise<AgentResult<ComplianceOutput>> {
  const result: AgentResult<ComplianceOutput> = {
    ok: false,
    decision_summary: `Compliance failed: ${error}`,
    confidence: 0,
    citations: [],
    latency_ms: latency_ms ?? Date.now() - started,
    error,
  };
  await recordAgentRun(ctx.supabase, "compliance_primary", ctx.case_id, result);
  return result;
}
