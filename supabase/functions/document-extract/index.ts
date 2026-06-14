// Vetair document-extract edge function.
//
// Triggered (fire-and-forget) by the WhatsApp webhook whenever an inbound
// message carries media (image or document). Responsibilities:
//
//   1. Fetch the media bytes from Meta's Graph API (their signed URLs expire
//      after ~5 minutes, so we extract synchronously rather than queuing).
//   2. Send the bytes to Claude Sonnet 4 vision for classification + field
//      extraction (single call, structured JSON output).
//   3. Persist a `documents` row with extracted_fields + confidence.
//   4. Backfill any safe pet fields (microchip_id, date_of_birth) that the
//      pet row is still missing. Existing values are never overwritten —
//      that's an orchestrator decision once a Compliance/Auditor mismatch is
//      flagged.
//   5. Log to `agent_logs` so the cost shows up on the Factory page.
//
// Always returns 200 with a JSON body. Errors are recorded in agent_logs so
// the dispatcher (webhook) doesn't need to know.
//
// Env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   WHATSAPP_ACCESS_TOKEN         — Meta system user token
//   ANTHROPIC_API_KEY             — Claude vision
//   ANTHROPIC_VISION_MODEL?       — defaults to claude-sonnet-4-6

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const VISION_MODEL = Deno.env.get("ANTHROPIC_VISION_MODEL") ?? "claude-sonnet-4-6";
const META_GRAPH = "https://graph.facebook.com/v21.0";

type DocumentKind =
  | "rabies_certificate"
  | "microchip_record"
  | "health_certificate"
  | "import_permit"
  | "export_permit"
  | "vet_invoice"
  | "passport_id_page"
  | "pet_photo"
  | "unknown";

interface ExtractedDocument {
  classification: DocumentKind;
  confidence: number;
  pet_name: string | null;
  microchip_id: string | null;
  species: string | null;
  breed: string | null;
  date_of_birth: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  issuer: string | null;
  document_number: string | null;
  country_of_origin: string | null;
  vaccine_name: string | null;
  manufacturer: string | null;
  batch_number: string | null;
  vet_name: string | null;
  vet_license: string | null;
  raw_notes: string | null;
}

interface RequestBody {
  case_id: string;
  owner_id: string | null;
  comms_message_id: string | null;
  media_id: string;
  mime: string;
  filename: string | null;
}

const EXTRACTION_PROMPT = `You are a document extraction agent for pet-relocation casework.

TASK:
1. Classify this document into exactly one of:
   rabies_certificate, microchip_record, health_certificate, import_permit,
   export_permit, vet_invoice, passport_id_page, pet_photo, unknown.
2. Extract the fields listed in the JSON schema. Use null for fields that are
   not present or you are not confident about.
3. Output ONLY JSON matching the schema. No prose, no code fences.

RULES:
- Dates as ISO (YYYY-MM-DD). If only a year or month is visible, return null.
- Microchip IDs are 15 digits, ISO 11784/11785. Strip spaces/hyphens.
- Do not invent values. A single illegible character means null.
- Never provide a confidence above 0.9 for hand-written or partially obscured
  documents.
- 'raw_notes' is a free-text field for anything important the schema doesn't
  capture (max 200 chars).

JSON schema (all keys required; use null where unknown):
{
  "classification": "rabies_certificate | microchip_record | ...",
  "confidence": 0.0-1.0,
  "pet_name": string|null,
  "microchip_id": string|null,
  "species": string|null,
  "breed": string|null,
  "date_of_birth": string|null,
  "issue_date": string|null,
  "expiry_date": string|null,
  "issuer": string|null,
  "document_number": string|null,
  "country_of_origin": string|null,
  "vaccine_name": string|null,
  "manufacturer": string|null,
  "batch_number": string|null,
  "vet_name": string|null,
  "vet_license": string|null,
  "raw_notes": string|null
}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.media_id || !body.case_id) {
    return json({ error: "case_id and media_id required" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const startedAt = Date.now();

  try {
    if (!ANTHROPIC_API_KEY) {
      return await failExtraction(supabase, body, startedAt, "ANTHROPIC_API_KEY not configured");
    }

    const mediaRes = await fetchMetaMedia(body.media_id);
    if (!mediaRes.ok) {
      return await failExtraction(supabase, body, startedAt, mediaRes.error);
    }

    const extraction = await extractWithClaude(
      ANTHROPIC_API_KEY,
      mediaRes.bytes,
      mediaRes.mime ?? body.mime,
    );
    if (!extraction.ok) {
      return await failExtraction(supabase, body, startedAt, extraction.error);
    }

    const docId = await persistDocument(supabase, body, extraction.data, extraction.tokens);
    await maybeBackfillPet(supabase, body.case_id, extraction.data);

    await logAgent(supabase, body.case_id, {
      decision: `Extracted ${extraction.data.classification} (conf ${extraction.data.confidence}).`,
      tokens_in: extraction.tokens.input,
      tokens_out: extraction.tokens.output,
      latency_ms: Date.now() - startedAt,
      payload: { document_id: docId, classification: extraction.data.classification },
      error: null,
    });

    return json({
      ok: true,
      document_id: docId,
      classification: extraction.data.classification,
      confidence: extraction.data.confidence,
    });
  } catch (err) {
    return await failExtraction(
      supabase,
      body,
      startedAt,
      `unhandled: ${(err as Error).message}`,
    );
  }
});

// ---------- Meta media fetch ----------

async function fetchMetaMedia(
  mediaId: string,
): Promise<{ ok: true; bytes: Uint8Array; mime: string | null } | { ok: false; error: string }> {
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  if (!token) return { ok: false, error: "WHATSAPP_ACCESS_TOKEN not configured" };

  const metaRes = await fetch(`${META_GRAPH}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) {
    return { ok: false, error: `Meta media lookup HTTP ${metaRes.status}` };
  }
  const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
  if (!meta.url) return { ok: false, error: "No url in media metadata" };

  const binRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!binRes.ok) return { ok: false, error: `Binary fetch HTTP ${binRes.status}` };

  const buf = await binRes.arrayBuffer();
  return { ok: true, bytes: new Uint8Array(buf), mime: meta.mime_type ?? null };
}

// ---------- Claude vision ----------

interface ExtractionTokens {
  input: number;
  output: number;
}

async function extractWithClaude(
  apiKey: string,
  bytes: Uint8Array,
  mime: string,
): Promise<
  | { ok: true; data: ExtractedDocument; tokens: ExtractionTokens }
  | { ok: false; error: string }
> {
  const base64 = bytesToBase64(bytes);
  const isPdf = mime === "application/pdf";
  const contentBlock = isPdf
    ? {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      }
    : {
        type: "image",
        source: { type: "base64", media_type: mime, data: base64 },
      };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      max_tokens: 1024,
      system: EXTRACTION_PROMPT,
      messages: [
        {
          role: "user",
          content: [contentBlock, { type: "text", text: "Extract the fields per the schema." }],
        },
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { ok: false, error: `Anthropic HTTP ${res.status}: ${errText.slice(0, 200)}` };
  }

  interface AnthropicResponse {
    content?: { type?: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  }
  const data = (await res.json()) as AnthropicResponse;
  const text = data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
  if (!text) return { ok: false, error: "empty response from Anthropic" };

  const cleaned = text.replace(/^```json\s*|```\s*$/g, "").trim();
  let parsed: ExtractedDocument;
  try {
    parsed = JSON.parse(cleaned) as ExtractedDocument;
  } catch {
    return { ok: false, error: `model returned non-JSON: ${cleaned.slice(0, 200)}` };
  }
  return {
    ok: true,
    data: parsed,
    tokens: {
      input: data.usage?.input_tokens ?? 0,
      output: data.usage?.output_tokens ?? 0,
    },
  };
}

// Chunked base64 encoder — large PDFs blow the call-stack with the naive form.
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// ---------- persistence ----------

async function persistDocument(
  supabase: SupabaseClient,
  body: RequestBody,
  doc: ExtractedDocument,
  tokens: ExtractionTokens,
): Promise<string | null> {
  const { data } = await supabase
    .from("documents")
    .insert({
      case_id: body.case_id,
      owner_id: body.owner_id,
      source_comms_message_id: body.comms_message_id,
      document_type: doc.classification,
      filename: body.filename,
      mime_type: body.mime,
      extracted_fields: doc,
      extraction_confidence: doc.confidence,
      extraction_model: VISION_MODEL,
      extraction_tokens_in: tokens.input,
      extraction_tokens_out: tokens.output,
    })
    .select("id")
    .single();
  return (data as { id: string } | null)?.id ?? null;
}

async function maybeBackfillPet(
  supabase: SupabaseClient,
  caseId: string,
  doc: ExtractedDocument,
): Promise<void> {
  const { data: caseRow } = await supabase
    .from("cases")
    .select("pet_id")
    .eq("id", caseId)
    .maybeSingle();
  const petId = (caseRow as { pet_id: string | null } | null)?.pet_id;
  if (!petId) return;

  const { data: petRow } = await supabase
    .from("pets")
    .select("name, breed, species, microchip_id, date_of_birth")
    .eq("id", petId)
    .maybeSingle();
  if (!petRow) return;

  const pet = petRow as {
    name: string | null;
    breed: string | null;
    species: string | null;
    microchip_id: string | null;
    date_of_birth: string | null;
  };
  const patch: Record<string, unknown> = {};
  if (!pet.microchip_id && doc.microchip_id) patch.microchip_id = doc.microchip_id;
  if (!pet.date_of_birth && doc.date_of_birth) patch.date_of_birth = doc.date_of_birth;
  if (!pet.breed && doc.breed) patch.breed = doc.breed;
  if (!pet.species && doc.species) patch.species = doc.species;
  if (!pet.name && doc.pet_name) patch.name = doc.pet_name;

  if (Object.keys(patch).length > 0) {
    await supabase.from("pets").update(patch).eq("id", petId);
  }
}

interface AgentLogInput {
  decision: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  payload: Record<string, unknown>;
  error: string | null;
}

async function logAgent(
  supabase: SupabaseClient,
  caseId: string,
  log: AgentLogInput,
): Promise<void> {
  // Sonnet 4 is $3/MTok in, $15/MTok out — same pricing as Sonnet 3.7.
  const costUsd = (log.tokens_in * 3 + log.tokens_out * 15) / 1_000_000;
  await supabase.from("agent_logs").insert({
    case_id: caseId,
    agent_name: "document",
    model: VISION_MODEL,
    input_tokens: log.tokens_in,
    output_tokens: log.tokens_out,
    cost_usd: costUsd,
    latency_ms: log.latency_ms,
    decision_summary: log.decision.slice(0, 500),
    confidence: 0.95,
    output_payload: log.payload,
    error_message: log.error,
  });
}

async function failExtraction(
  supabase: SupabaseClient,
  body: RequestBody,
  startedAt: number,
  error: string,
): Promise<Response> {
  await logAgent(supabase, body.case_id, {
    decision: `extraction_failed: ${error.slice(0, 400)}`,
    tokens_in: 0,
    tokens_out: 0,
    latency_ms: Date.now() - startedAt,
    payload: { media_id: body.media_id, comms_message_id: body.comms_message_id },
    error,
  });
  return json({ ok: false, error }, 200);
}
