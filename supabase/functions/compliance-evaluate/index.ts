// Vetair compliance-evaluate edge function.
// Three-voice spine: deterministic TS + Claude Sonnet 4 primary + Claude Opus 4.7 adversarial auditor.
// Writes requirement_evaluations rows (one per voice per rule) and a consensus_rounds row.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { evaluateRule, aggregateVerdict, type Pet, type DocumentRecord, type CountryRule, type CaseContext } from "./compliance_engine.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

async function callClaude(apiKey: string, model: string, system: string, user: string): Promise<{ text: string; input_tokens: number; output_tokens: number }> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 4096, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`Claude ${model} error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  return { text, input_tokens: data.usage?.input_tokens ?? 0, output_tokens: data.usage?.output_tokens ?? 0 };
}

function parseClaudeVerdict(raw: string): { verdict: "approved" | "blocked" | "pending"; earliest_legal_departure: string | null; rationale: string } {
  const clean = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try {
    const p = JSON.parse(clean);
    return { verdict: p.verdict, earliest_legal_departure: p.earliest_legal_departure ?? null, rationale: p.rationale ?? "" };
  } catch {
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) {
      const p = JSON.parse(m[0]);
      return { verdict: p.verdict, earliest_legal_departure: p.earliest_legal_departure ?? null, rationale: p.rationale ?? "" };
    }
    throw new Error("Could not parse Claude verdict JSON");
  }
}

const PRIMARY_SYSTEM = `You are the Primary Compliance Agent for Vetair, a pet relocation platform. You evaluate whether a pet meets the regulatory requirements for a corridor (origin country -> destination country).

CRITICAL RULES:
1. You can ONLY reference requirement_code values that appear in the rules context provided below. NEVER invent codes.
2. For every claim, cite the requirement_code.
3. If evidence is missing, return status "pending" — do not guess.
4. Return ONLY valid JSON, no markdown, no prose preamble.

Output schema:
{
  "verdict": "approved" | "blocked" | "pending",
  "earliest_legal_departure": "YYYY-MM-DD" | null,
  "rationale": "One-paragraph summary citing requirement_codes",
  "per_rule": [ { "requirement_code": "...", "status": "satisfied"|"pending"|"blocked"|"not_applicable", "notes": "..." } ]
}`;

const AUDITOR_SYSTEM = `You are the Adversarial Compliance Auditor for Vetair. Your job is to DISPROVE the primary verdict — find ANY reason this case CANNOT legally fly, even if the primary agent said approved.

Reverse-framing rules:
1. Assume the primary agent may have missed something. Look for: missed time constraints, overlooked breed restrictions, age calculations, sequencing errors (microchip must precede vaccine, etc.).
2. Only cite requirement_codes that appear in the rules context. NEVER invent codes.
3. If after genuine adversarial analysis you still cannot find a blocker, agree with the primary verdict.
4. Return ONLY valid JSON.

Output schema:
{
  "verdict": "approved" | "blocked" | "pending",
  "earliest_legal_departure": "YYYY-MM-DD" | null,
  "rationale": "Describe what you tried to find and whether any blocker exists",
  "agreement_with_primary": true | false
}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

  let body: { case_id: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const { case_id } = body;
  if (!case_id) return json({ error: "case_id required" }, 400);

  // Load case, pet, documents
  const { data: caseRow, error: caseErr } = await supabase.from("cases").select("*").eq("id", case_id).single();
  if (caseErr || !caseRow) return json({ error: "case not found", detail: caseErr?.message }, 404);

  const { data: petRow } = await supabase.from("pets").select("*").eq("id", caseRow.pet_id).single();
  if (!petRow) return json({ error: "pet not found" }, 404);

  const { data: docRows } = await supabase.from("documents").select("*").eq("case_id", case_id);
  const docs: DocumentRecord[] = (docRows ?? []) as DocumentRecord[];

  const { data: ruleRows } = await supabase.from("country_rules")
    .select("*")
    .eq("origin_country", caseRow.origin_country)
    .eq("destination_country", caseRow.destination_country)
    .eq("species", petRow.species)
    .eq("is_active", true)
    .order("priority", { ascending: false });

  if (!ruleRows || ruleRows.length === 0) return json({ error: "no rules for this corridor+species" }, 404);

  const rules: CountryRule[] = ruleRows as CountryRule[];
  const pet: Pet = petRow as Pet;
  const caseCtx: CaseContext = {
    id: caseRow.id,
    origin_country: caseRow.origin_country,
    destination_country: caseRow.destination_country,
    target_date: caseRow.target_date,
  };

  // ---- Voice 1: Deterministic TS ----
  const detPerRule = rules.map((rule) => ({ rule, evaluation: evaluateRule(pet, docs, rule, caseCtx) }));
  const detAgg = aggregateVerdict(detPerRule);
  const detRationale = `Deterministic engine evaluated ${rules.length} rules. Verdict: ${detAgg.verdict}. ${detAgg.earliest_legal_departure ? `Earliest legal departure: ${detAgg.earliest_legal_departure}.` : ""}`;

  // Build rules context string for LLM voices
  const rulesContext = rules.map((r) => `- ${r.requirement_code} (${r.requirement_type}, priority ${r.priority}): ${r.evidence_schema && JSON.stringify(r.evidence_schema)} | constraints: ${JSON.stringify(r.time_constraints ?? {})}`).join("\n");
  const caseContext = `PET: ${JSON.stringify(pet)}\nCASE: origin=${caseCtx.origin_country}, destination=${caseCtx.destination_country}, target_date=${caseCtx.target_date}\nDOCUMENTS:\n${docs.map((d) => `- ${d.document_type}: ${JSON.stringify(d.extracted_fields)}`).join("\n") || "(none uploaded)"}\nRULES:\n${rulesContext}`;

  // ---- Voice 2: Primary Claude Sonnet 4 ----
  const primaryStart = Date.now();
  let primary: { verdict: "approved" | "blocked" | "pending"; earliest_legal_departure: string | null; rationale: string } = { verdict: "pending", earliest_legal_departure: null, rationale: "" };
  let primaryTokens = { input: 0, output: 0 };
  try {
    const resp = await callClaude(apiKey, "claude-sonnet-4-20250514", PRIMARY_SYSTEM, caseContext);
    primary = parseClaudeVerdict(resp.text);
    primaryTokens = { input: resp.input_tokens, output: resp.output_tokens };
  } catch (e) {
    primary = { verdict: "pending", earliest_legal_departure: null, rationale: `Primary agent error: ${(e as Error).message}` };
  }
  const primaryMs = Date.now() - primaryStart;

  // ---- Voice 3: Adversarial Opus 4.7 Auditor ----
  const auditorStart = Date.now();
  let auditor: { verdict: "approved" | "blocked" | "pending"; earliest_legal_departure: string | null; rationale: string } = { verdict: "pending", earliest_legal_departure: null, rationale: "" };
  let auditorTokens = { input: 0, output: 0 };
  try {
    const primaryStatement = `PRIMARY AGENT VERDICT TO DISPROVE: ${primary.verdict} (earliest: ${primary.earliest_legal_departure ?? "n/a"})\nPrimary rationale: ${primary.rationale}\n\n${caseContext}`;
    const resp = await callClaude(apiKey, "claude-opus-4-20250514", AUDITOR_SYSTEM, primaryStatement);
    auditor = parseClaudeVerdict(resp.text);
    auditorTokens = { input: resp.input_tokens, output: resp.output_tokens };
  } catch (e) {
    auditor = { verdict: primary.verdict, earliest_legal_departure: primary.earliest_legal_departure, rationale: `Auditor unavailable: ${(e as Error).message}. Defaulting to primary.` };
  }
  const auditorMs = Date.now() - auditorStart;

  // ---- Resolve consensus ----
  const verdicts = [detAgg.verdict, primary.verdict, auditor.verdict];
  const allAgree = verdicts.every((v) => v === verdicts[0]);
  const majorityCount: Record<string, number> = {};
  verdicts.forEach((v) => { majorityCount[v] = (majorityCount[v] ?? 0) + 1; });
  const majorityVerdict = Object.entries(majorityCount).sort((a, b) => b[1] - a[1])[0][0] as "approved" | "blocked" | "pending";
  const majorityStrength = majorityCount[majorityVerdict];

  const resolution = allAgree ? "consensus" : (majorityStrength >= 2 ? "disagreement" : "escalated");

  const finalVerdict = {
    verdict: allAgree ? verdicts[0] : majorityVerdict,
    earliest_legal_departure: detAgg.earliest_legal_departure ?? primary.earliest_legal_departure ?? auditor.earliest_legal_departure,
    three_voices: {
      deterministic: { verdict: detAgg.verdict, earliest_legal_departure: detAgg.earliest_legal_departure, rationale: detRationale },
      primary: { ...primary, model: "claude-sonnet-4-20250514" },
      auditor: { ...auditor, model: "claude-opus-4-20250514" },
    },
  };

  // Write consensus round
  const { data: consensusRow } = await supabase.from("consensus_rounds").insert({
    case_id,
    topic: "compliance_verdict",
    participants: ["deterministic", "compliance_primary", "compliance_auditor"],
    votes: [
      { voice: "deterministic", verdict: detAgg.verdict },
      { voice: "compliance_primary", verdict: primary.verdict },
      { voice: "compliance_auditor", verdict: auditor.verdict },
    ],
    resolution,
    final_verdict: finalVerdict,
    disagreement_details: allAgree ? null : `verdicts: det=${detAgg.verdict}, primary=${primary.verdict}, auditor=${auditor.verdict}`,
    resolved_at: new Date().toISOString(),
  }).select("id").single();

  // Write per-rule requirement_evaluations from deterministic voice
  const evalRows = detPerRule.map((r) => ({
    case_id,
    country_rule_id: r.rule.id,
    status: r.evaluation.status,
    evidence_document_ids: r.evaluation.evidence_document_ids,
    evaluator: "deterministic",
    confidence: r.evaluation.confidence,
    notes: r.evaluation.notes,
    earliest_legal_date: r.evaluation.earliest_legal_date ?? null,
    blocking_reason: r.evaluation.blocking_reason ?? null,
  }));
  if (evalRows.length > 0) await supabase.from("requirement_evaluations").insert(evalRows);

  // Log agent calls
  await supabase.from("agent_logs").insert([
    { case_id, agent_name: "deterministic_engine", model: "ts-v1", latency_ms: 0, decision_summary: detRationale, confidence: 1.0, output_payload: { verdict: detAgg.verdict, earliest_legal_departure: detAgg.earliest_legal_departure } },
    { case_id, agent_name: "compliance_primary", model: "claude-sonnet-4-20250514", input_tokens: primaryTokens.input, output_tokens: primaryTokens.output, cost_usd: (primaryTokens.input * 3 + primaryTokens.output * 15) / 1_000_000, latency_ms: primaryMs, decision_summary: primary.rationale.slice(0, 500), confidence: primary.verdict === "pending" ? 0.5 : 0.95, output_payload: primary },
    { case_id, agent_name: "compliance_auditor", model: "claude-opus-4-20250514", input_tokens: auditorTokens.input, output_tokens: auditorTokens.output, cost_usd: (auditorTokens.input * 15 + auditorTokens.output * 75) / 1_000_000, latency_ms: auditorMs, decision_summary: auditor.rationale.slice(0, 500), confidence: 0.95, output_payload: auditor },
  ]);

  // Update case state based on final verdict
  const nextState = finalVerdict.verdict === "approved" ? "approved" : finalVerdict.verdict === "blocked" ? "blocked" : "assessment";
  await supabase.from("cases").update({ state: nextState, earliest_legal_departure: finalVerdict.earliest_legal_departure }).eq("id", case_id);

  return json({
    success: true,
    consensus_round_id: consensusRow?.id ?? null,
    resolution,
    final_verdict: finalVerdict,
    case_state: nextState,
    stats: { rules_evaluated: rules.length, primary_latency_ms: primaryMs, auditor_latency_ms: auditorMs, total_cost_usd: ((primaryTokens.input * 3 + primaryTokens.output * 15) + (auditorTokens.input * 15 + auditorTokens.output * 75)) / 1_000_000 },
  });
});
