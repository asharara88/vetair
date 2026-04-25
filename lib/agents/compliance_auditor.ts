// Compliance Auditor — agent #4 / voice 3 of the three-voice spine.
//
// Adversarial re-check of the primary verdict. Re-asked with reversed framing:
// "find ANY reason this case CANNOT fly." Defaults to agreeing with the
// primary if no blocker is found after genuine analysis.
//
// Always called with the primary verdict as part of its input — the prompt
// instructs it to disprove the primary, not to start cold.

import "server-only";
import type { AgentContext, AgentMeta, AgentResult, Citation } from "./types";
import { callClaude, parseJson } from "./anthropic";
import { renderPrompt } from "./prompt";
import { modelFor } from "./models";
import { recordAgentRun } from "./log";
import type { ComplianceOutput, Verdict } from "./compliance";

export const meta: AgentMeta = {
  name: "compliance_auditor",
  description: "Adversarial compliance voice. Reverse-framing: find any reason the case CANNOT fly.",
  default_model: modelFor("compliance_auditor"),
  input_budget_tokens: 32_000,
};

export interface AuditorOutput {
  verdict: Verdict;
  earliest_legal_departure: string | null;
  rationale: string;
  agreement_with_primary: boolean;
  blockers_found: Array<{ requirement_code: string; reason: string }>;
}

export async function run(
  ctx: AgentContext & { payload: { primary: ComplianceOutput } },
): Promise<AgentResult<AuditorOutput>> {
  const started = Date.now();
  const primary = ctx.payload?.primary;
  if (!primary) return fail(ctx, "missing payload.primary", started);

  const { data: caseRow } = await ctx.supabase
    .from("cases")
    .select("id, origin_country, destination_country, target_date, pet_id")
    .eq("id", ctx.case_id)
    .single();
  if (!caseRow) return fail(ctx, "case not found", started);

  const { data: pet } = await ctx.supabase.from("pets").select("*").eq("id", caseRow.pet_id).single();
  const { data: docs } = await ctx.supabase.from("documents").select("*").eq("case_id", ctx.case_id);
  const { data: rules } = await ctx.supabase
    .from("country_rules")
    .select("requirement_code, requirement_type, evidence_schema, time_constraints, priority, source_url")
    .eq("origin_country", caseRow.origin_country)
    .eq("destination_country", caseRow.destination_country)
    .eq("species", pet?.species ?? "dog")
    .eq("is_active", true);

  const system = renderPrompt("compliance_auditor", { case_id: ctx.case_id });
  const user = JSON.stringify(
    {
      primary_verdict: primary,
      case: caseRow,
      pet,
      documents: docs ?? [],
      rules: rules ?? [],
    },
    null,
    2,
  );

  const call = await callClaude({
    model: meta.default_model,
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: 4_096,
    temperature: 0,
  });
  if (!call.ok) return fail(ctx, call.error, started, call.latency_ms);

  const parsed = parseJson<AuditorOutput>(call.text);
  if (!parsed) return fail(ctx, `non-JSON from auditor: ${call.text.slice(0, 200)}`, started, call.latency_ms);

  const validCodes = new Set((rules ?? []).map((r) => r.requirement_code));
  const hallucinated = parsed.blockers_found.filter((b) => !validCodes.has(b.requirement_code));
  if (hallucinated.length > 0) {
    return fail(
      ctx,
      `auditor hallucinated codes: ${hallucinated.map((h) => h.requirement_code).join(", ")}`,
      started,
      call.latency_ms,
    );
  }

  const citations: Citation[] = parsed.blockers_found.map((b) => ({
    requirement_code: b.requirement_code,
    source_url: (rules ?? []).find((r) => r.requirement_code === b.requirement_code)?.source_url ?? null,
  }));

  const result: AgentResult<AuditorOutput> = {
    ok: true,
    output: parsed,
    decision_summary: parsed.rationale.slice(0, 500),
    confidence: 0.95,
    citations,
    model: call.response.model,
    input_tokens: call.response.usage.input_tokens,
    output_tokens: call.response.usage.output_tokens,
    cost_usd: call.cost_usd,
    latency_ms: call.latency_ms,
  };
  await recordAgentRun(ctx.supabase, "compliance_auditor", ctx.case_id, result, {
    input_payload: { primary_verdict: primary.verdict, blockers_seen: parsed.blockers_found.length },
    output_payload: parsed,
  });
  return result;
}

async function fail(
  ctx: AgentContext,
  error: string,
  started: number,
  latency_ms?: number,
): Promise<AgentResult<AuditorOutput>> {
  const result: AgentResult<AuditorOutput> = {
    ok: false,
    decision_summary: `Auditor failed: ${error}`,
    confidence: 0,
    citations: [],
    latency_ms: latency_ms ?? Date.now() - started,
    error,
  };
  await recordAgentRun(ctx.supabase, "compliance_auditor", ctx.case_id, result);
  return result;
}
