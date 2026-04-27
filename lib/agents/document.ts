// Document agent — agent #2.
//
// Wraps lib/document-extract.ts: pulls a documents row, fetches the storage
// or signed-URL bytes, calls Claude vision to extract structured fields,
// writes them back, and records the agent_logs row.

import "server-only";
import type { AgentContext, AgentMeta, AgentResult } from "./types";
import { extractDocument } from "@/lib/document-extract";
import { recordAgentRun } from "./log";
import { modelFor } from "./models";

export const meta: AgentMeta = {
  name: "document_agent",
  description: "Reads uploaded docs natively via Claude vision; extracts structured fields.",
  default_model: modelFor("document_agent"),
  input_budget_tokens: 32_000,
};

export interface DocumentOutput {
  document_id: string;
  classification: string;
  confidence: number;
  fields: Record<string, unknown>;
}

export async function run(ctx: AgentContext): Promise<AgentResult<DocumentOutput>> {
  const started = Date.now();
  const documentId = ctx.payload?.document_id as string | undefined;
  if (!documentId) return fail(ctx, "missing payload.document_id", started);

  const { data: docRow, error: docErr } = await ctx.supabase
    .from("documents")
    .select("id, source_url, storage_path, mime_type")
    .eq("id", documentId)
    .single();
  if (docErr || !docRow) return fail(ctx, `document ${documentId} not found`, started);

  const url = docRow.source_url as string | null;
  if (!url) return fail(ctx, "document has no source_url to fetch", started);

  const fetched = await fetch(url);
  if (!fetched.ok) return fail(ctx, `source fetch ${fetched.status}`, started);
  const bytes = await fetched.arrayBuffer();
  const mime = (docRow.mime_type as string | null) ?? fetched.headers.get("content-type") ?? "application/octet-stream";

  const extraction = await extractDocument(bytes, mime);
  if (!extraction.ok) return fail(ctx, extraction.error, started);

  const { data, tokens_in, tokens_out } = extraction;
  await ctx.supabase
    .from("documents")
    .update({
      document_type: data.classification,
      extracted_fields: data,
      extraction_confidence: data.confidence,
    })
    .eq("id", documentId);

  const result: AgentResult<DocumentOutput> = {
    ok: true,
    output: {
      document_id: documentId,
      classification: data.classification,
      confidence: data.confidence,
      fields: data as unknown as Record<string, unknown>,
    },
    decision_summary: `Classified as ${data.classification} (conf ${data.confidence.toFixed(2)})`,
    confidence: data.confidence,
    citations: [],
    model: meta.default_model,
    input_tokens: tokens_in,
    output_tokens: tokens_out,
    cost_usd: (tokens_in * 3 + tokens_out * 15) / 1_000_000,
    latency_ms: Date.now() - started,
  };
  await recordAgentRun(ctx.supabase, "document_agent", ctx.case_id, result, {
    input_payload: { document_id: documentId, mime },
    output_payload: data as unknown as Record<string, unknown>,
  });
  return result;
}

async function fail(
  ctx: AgentContext,
  error: string,
  started: number,
): Promise<AgentResult<DocumentOutput>> {
  const result: AgentResult<DocumentOutput> = {
    ok: false,
    decision_summary: `Document extraction failed: ${error}`,
    confidence: 0,
    citations: [],
    latency_ms: Date.now() - started,
    error,
  };
  await recordAgentRun(ctx.supabase, "document_agent", ctx.case_id, result);
  return result;
}
