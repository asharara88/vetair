// Vetair document-extract edge function.
// Consumes a `task_queue` row of type `document_extract`. Fetches the inbound
// media bytes from Meta (the signed URL only lives ~5 min so we run this
// promptly after the webhook enqueues), runs a single Claude Sonnet 4 vision
// call to classify + extract, and writes the structured fields back to the
// originating `comms_messages.media_urls[0]` entry plus a fresh `documents`
// row that the compliance pipeline can consume.
//
// Invocation modes:
//   { task_id }                       — claim a queued task by id, run it
//   { comms_message_id, media_id, mime, filename? }
//                                     — run inline (no queue), useful for
//                                       backfill or for the webhook to call
//                                       directly when latency matters
//
// Env vars: ANTHROPIC_API_KEY, WHATSAPP_ACCESS_TOKEN,
//           SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = Deno.env.get("ANTHROPIC_VISION_MODEL") ?? "claude-sonnet-4-6";

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
- Never provide a confidence above 0.9 for hand-written or partially obscured documents.

Schema:
{
  "classification": string,
  "confidence": number,
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

interface ExtractionPayload {
  comms_message_id: string;
  media_id: string;
  mime: string;
  filename?: string | null;
}

interface TaskRow {
  id: string;
  case_id: string | null;
  payload: ExtractionPayload;
  status: string;
}

interface ExtractedDocument {
  classification: string;
  confidence: number;
  [key: string]: unknown;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  const META_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "supabase env missing" }, 500);
  if (!ANTHROPIC_KEY) return json({ error: "ANTHROPIC_API_KEY missing" }, 500);
  if (!META_TOKEN) return json({ error: "WHATSAPP_ACCESS_TOKEN missing" }, 500);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Resolve the task — either claim by id, or run inline from request body.
  let task: TaskRow | null = null;
  if (typeof body.task_id === "string") {
    const claimed = await claimTask(supabase, body.task_id);
    if (!claimed.ok) return json({ error: claimed.error }, 404);
    task = claimed.task;
  } else if (typeof body.comms_message_id === "string" && typeof body.media_id === "string" && typeof body.mime === "string") {
    task = {
      id: "",
      case_id: typeof body.case_id === "string" ? body.case_id : null,
      payload: {
        comms_message_id: body.comms_message_id,
        media_id: body.media_id,
        mime: body.mime,
        filename: typeof body.filename === "string" ? body.filename : null,
      },
      status: "inline",
    };
  } else {
    return json({ error: "must provide task_id or {comms_message_id, media_id, mime}" }, 400);
  }

  try {
    const bytes = await fetchMediaBytes(task.payload.media_id, META_TOKEN);
    const extraction = await extractDocument(bytes.data, bytes.mime, ANTHROPIC_KEY);

    await supabase
      .from("comms_messages")
      .update({
        media_urls: [
          {
            media_id: task.payload.media_id,
            mime: bytes.mime,
            filename: task.payload.filename ?? null,
            classification: extraction.classification,
            confidence: extraction.confidence,
            extracted_fields: extraction,
          },
        ],
      })
      .eq("id", task.payload.comms_message_id);

    if (task.case_id) {
      await supabase.from("documents").insert({
        case_id: task.case_id,
        comms_message_id: task.payload.comms_message_id,
        document_type: extraction.classification,
        extracted_fields: extraction,
        extraction_confidence: extraction.confidence,
        source_media_id: task.payload.media_id,
      });
    }

    if (task.id) {
      await supabase
        .from("task_queue")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", task.id);
    }

    return json({ ok: true, classification: extraction.classification, confidence: extraction.confidence });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (task.id) {
      await supabase
        .from("task_queue")
        .update({ status: "failed", completed_at: new Date().toISOString(), error_message: message })
        .eq("id", task.id);
    }
    return json({ ok: false, error: message }, 500);
  }
});

async function claimTask(
  supabase: ReturnType<typeof createClient>,
  taskId: string,
): Promise<{ ok: true; task: TaskRow } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("task_queue")
    .update({ status: "running", claimed_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("status", "pending")
    .select("id, case_id, payload, status")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "task not found or already claimed" };
  return { ok: true, task: data as TaskRow };
}

async function fetchMediaBytes(
  mediaId: string,
  metaToken: string,
): Promise<{ data: ArrayBuffer; mime: string }> {
  const metaRes = await fetch(`${GRAPH_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${metaToken}` },
  });
  if (!metaRes.ok) throw new Error(`Meta media lookup HTTP ${metaRes.status}`);
  const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
  if (!meta.url) throw new Error("No url in media metadata");

  const bin = await fetch(meta.url, { headers: { Authorization: `Bearer ${metaToken}` } });
  if (!bin.ok) throw new Error(`Binary fetch HTTP ${bin.status}`);
  return { data: await bin.arrayBuffer(), mime: meta.mime_type ?? "application/octet-stream" };
}

async function extractDocument(
  bytes: ArrayBuffer,
  mime: string,
  apiKey: string,
): Promise<ExtractedDocument> {
  const base64 = bufferToBase64(bytes);
  const contentBlock =
    mime === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mime, data: base64 } };

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: EXTRACTION_PROMPT,
      messages: [{ role: "user", content: [contentBlock, { type: "text", text: "Extract the fields per the schema." }] }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = (await res.json()) as { content?: { type?: string; text?: string }[] };
  const text = data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
  if (!text) throw new Error("empty response from Anthropic");

  const cleaned = text.replace(/^```json\s*|```\s*$/g, "").trim();
  try {
    return JSON.parse(cleaned) as ExtractedDocument;
  } catch {
    throw new Error(`model returned non-JSON: ${cleaned.slice(0, 200)}`);
  }
}

function bufferToBase64(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < arr.length; i += chunk) {
    binary += String.fromCharCode(...arr.subarray(i, i + chunk));
  }
  return btoa(binary);
}
