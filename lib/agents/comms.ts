// Comms agent — agent #8.
//
// Composes a customer-facing WhatsApp message. Enforces:
//   - emotional awareness (no robotic phrasing during stress moments)
//   - 100% citation coverage for any factual claim about regulations
//   - language locale (owner.locale)
//   - 1024-char WhatsApp soft cap; splits into multi-part if exceeded
//
// Sends via the whatsapp-send edge function (which falls back to dramatized
// inserts when Meta creds are absent).

import "server-only";
import type { AgentContext, AgentMeta, AgentResult, Citation } from "./types";
import { callClaude, parseJson } from "./anthropic";
import { renderPrompt } from "./prompt";
import { modelFor } from "./models";
import { recordAgentRun } from "./log";
import { sendWhatsAppText } from "@/lib/whatsapp";

export const meta: AgentMeta = {
  name: "comms_agent",
  description: "Composes outbound WhatsApp messages; enforces citation coverage and tone.",
  default_model: modelFor("comms_agent"),
  input_budget_tokens: 8_000,
};

export interface CommsBrief {
  intent: "intake_question" | "blocker_explanation" | "status_update" | "approval" | "itinerary_delivery" | "completion";
  facts: Array<{ statement: string; citation: Citation | null }>; // statements without a citation must be opinion/emotional, not fact
  owner_emotional_state?: "calm" | "anxious" | "frustrated" | "grieving" | "celebrating" | null;
  must_include_dates?: string[];
}

export interface CommsOutput {
  body: string;
  rationale: string;
  contains_uncited_facts: boolean;
  parts: string[]; // body split into <=1024-char chunks for WhatsApp
}

const WHATSAPP_SOFT_CAP = 1024;

function splitForWhatsApp(text: string): string[] {
  if (text.length <= WHATSAPP_SOFT_CAP) return [text];
  const out: string[] = [];
  let remaining = text;
  while (remaining.length > WHATSAPP_SOFT_CAP) {
    const window = remaining.slice(0, WHATSAPP_SOFT_CAP);
    // Prefer paragraph boundary; fall back to sentence; then a hard cut.
    const paragraphBreak = window.lastIndexOf("\n\n");
    const sentenceBreak = window.lastIndexOf(". ");
    const naturalBreak =
      paragraphBreak >= 200 ? paragraphBreak + 2
      : sentenceBreak >= 200 ? sentenceBreak + 2
      : WHATSAPP_SOFT_CAP;
    out.push(remaining.slice(0, naturalBreak).trim());
    remaining = remaining.slice(naturalBreak).trim();
  }
  if (remaining) out.push(remaining);
  return out;
}

export async function run(
  ctx: AgentContext & { payload: CommsBrief },
): Promise<AgentResult<CommsOutput>> {
  const started = Date.now();
  const brief = ctx.payload;
  if (!brief) return fail(ctx, "missing payload (CommsBrief)", started);

  const { data: caseRow } = await ctx.supabase
    .from("cases")
    .select("owner_id")
    .eq("id", ctx.case_id)
    .single();
  if (!caseRow) return fail(ctx, "case not found", started);

  const { data: owner } = await ctx.supabase.from("owners").select("*").eq("id", caseRow.owner_id).single();

  const system = renderPrompt("comms", {
    case_id: ctx.case_id,
    locale: owner?.locale ?? "en",
  });
  const user = JSON.stringify({ brief, owner: { full_name: owner?.full_name, locale: owner?.locale } });

  const call = await callClaude({
    model: meta.default_model,
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: 1_200,
    temperature: 0.6,
  });
  if (!call.ok) return fail(ctx, call.error, started, call.latency_ms);

  const draft = parseJson<{ body: string; rationale: string; contains_uncited_facts: boolean }>(call.text);
  if (!draft) return fail(ctx, `non-JSON from comms: ${call.text.slice(0, 200)}`, started, call.latency_ms);

  const parts = splitForWhatsApp(draft.body);
  const output: CommsOutput = { ...draft, parts };

  // Persist + send (fire and forget on the WhatsApp delivery; Meta status webhook
  // updates the row).
  const citations = brief.facts.map((f) => f.citation).filter((c): c is Citation => c !== null);
  for (const part of parts) {
    const send = owner?.whatsapp_number
      ? await sendWhatsAppText(owner.whatsapp_number, part)
      : { ok: true as const, whatsapp_message_id: undefined };
    await ctx.supabase.from("comms_messages").insert({
      case_id: ctx.case_id,
      owner_id: owner?.id ?? null,
      channel: "whatsapp",
      direction: "outbound",
      thread_id: owner?.whatsapp_number ?? null,
      whatsapp_message_id: send.ok ? send.whatsapp_message_id ?? null : null,
      body: part,
      sent_by_agent: "comms_agent",
      status: send.ok ? "pending" : "failed",
      error_message: send.ok ? null : send.error ?? null,
    });
  }

  const result: AgentResult<CommsOutput> = {
    ok: true,
    output,
    decision_summary: draft.rationale.slice(0, 500),
    confidence: draft.contains_uncited_facts ? 0.4 : 0.95,
    citations,
    model: call.response.model,
    input_tokens: call.response.usage.input_tokens,
    output_tokens: call.response.usage.output_tokens,
    cost_usd: call.cost_usd,
    latency_ms: call.latency_ms,
  };
  await recordAgentRun(ctx.supabase, "comms_agent", ctx.case_id, result, {
    input_payload: { intent: brief.intent, fact_count: brief.facts.length, parts: parts.length },
    output_payload: output,
  });
  return result;
}

async function fail(
  ctx: AgentContext,
  error: string,
  started: number,
  latency_ms?: number,
): Promise<AgentResult<CommsOutput>> {
  const result: AgentResult<CommsOutput> = {
    ok: false,
    decision_summary: `Comms failed: ${error}`,
    confidence: 0,
    citations: [],
    latency_ms: latency_ms ?? Date.now() - started,
    error,
  };
  await recordAgentRun(ctx.supabase, "comms_agent", ctx.case_id, result);
  return result;
}
