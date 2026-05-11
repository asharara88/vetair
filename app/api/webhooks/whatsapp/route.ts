// WhatsApp Business webhook endpoint.
// URL that Meta will call: https://<your-vercel-domain>/api/webhooks/whatsapp
//
// - GET: Meta's one-time subscription challenge. We echo hub.challenge iff the
//   hub.verify_token matches our env var.
// - POST: message events (incoming messages, delivery/read receipts). We verify
//   the X-Hub-Signature-256 against WHATSAPP_APP_SECRET, persist the raw
//   payload to whatsapp_webhook_events for audit, then fan out to comms_messages
//   and (for media) fire-and-forget into the document-extract edge function.
//   We ALWAYS return 200 within a few seconds — Meta retries aggressively on
//   non-200.

import type { NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  verifyMetaSignature,
  type MetaWebhookPayload,
  type MetaInboundMessage,
  type MetaStatusUpdate,
  extractInboundMedia,
} from "@/lib/whatsapp";
import { SUPABASE_URL } from "@/lib/supabase";

export const runtime = "nodejs"; // need Web Crypto + service role
export const dynamic = "force-dynamic";

type Service = SupabaseClient;

function serviceClient(): Service {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

// ---------- GET: subscription verification ----------

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }
  return new Response("forbidden", { status: 403 });
}

// ---------- POST: message + status events ----------

export async function POST(req: NextRequest) {
  // We MUST read the raw body for signature verification — Next.js parses JSON
  // automatically if we call .json(), but the HMAC must be computed over the
  // exact bytes Meta sent us.
  const raw = await req.text();
  const signatureValid = await verifyMetaSignature(
    raw,
    req.headers.get("x-hub-signature-256"),
  );

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(raw) as MetaWebhookPayload;
  } catch {
    // not JSON — still 200 so Meta doesn't retry garbage forever
    return new Response("ok", { status: 200 });
  }

  const supabase = serviceClient();

  // Audit-log first, regardless of signature validity. We want a forensic trail
  // for every hit on this endpoint, including invalid attempts.
  await auditLog(supabase, payload, signatureValid);

  // If the signature is bad, we've audited the attempt but refuse to act on it.
  if (!signatureValid) {
    return new Response("ok", { status: 200 });
  }

  // Signature valid — process the events. We do this inline but keep it fast:
  // slow work (doc extraction, intake dispatch) is fire-and-forget to other
  // edge functions and not awaited here.
  const work: Promise<unknown>[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const contacts = value.contacts ?? [];
      for (const msg of value.messages ?? []) {
        work.push(handleInboundMessage(supabase, msg, contacts));
      }
      for (const st of value.statuses ?? []) {
        work.push(handleStatusUpdate(supabase, st));
      }
    }
  }
  await Promise.allSettled(work);

  return new Response("ok", { status: 200 });
}

// ---------- helpers ----------

async function auditLog(
  supabase: Service,
  payload: MetaWebhookPayload,
  signatureValid: boolean,
): Promise<void> {
  const rows: Array<Record<string, unknown>> = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      for (const msg of value.messages ?? []) {
        rows.push({
          signature_valid: signatureValid,
          event_type: "message",
          from_phone: msg.from,
          whatsapp_message_id: msg.id,
          payload: msg,
          processed: false,
        });
      }
      for (const st of value.statuses ?? []) {
        rows.push({
          signature_valid: signatureValid,
          event_type: "status",
          from_phone: st.recipient_id,
          whatsapp_message_id: st.id,
          payload: st,
          processed: false,
        });
      }
    }
  }
  if (rows.length === 0) {
    rows.push({
      signature_valid: signatureValid,
      event_type: "unknown",
      payload,
      processed: false,
    });
  }
  await supabase.from("whatsapp_webhook_events").insert(rows);
}

interface OwnerLite {
  id: string;
  full_name: string | null;
}

async function findOwnerByWhatsApp(
  supabase: Service,
  waNumberNoPlus: string,
): Promise<OwnerLite | null> {
  // Meta sends E.164 without leading +. Match both stored variants.
  const { data } = await supabase
    .from("owners")
    .select("id, full_name")
    .or(`whatsapp_number.eq.${waNumberNoPlus},whatsapp_number.eq.+${waNumberNoPlus}`)
    .maybeSingle();
  return (data as OwnerLite | null) ?? null;
}

async function findActiveCaseId(
  supabase: Service,
  ownerId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("cases")
    .select("id")
    .eq("owner_id", ownerId)
    .not("state", "in", "(closed,cancelled)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

async function openIntakeCase(
  supabase: Service,
  ownerId: string,
): Promise<string | null> {
  // Stub case for an inbound contact with no active case. The Intake agent
  // populates pet + corridor on subsequent turns.
  const caseNumber = `VTR-${Date.now().toString(36).toUpperCase()}`;
  const { data } = await supabase
    .from("cases")
    .insert({
      owner_id: ownerId,
      case_number: caseNumber,
      state: "intake",
      demo_mode: false,
    })
    .select("id")
    .single();
  return (data as { id: string } | null)?.id ?? null;
}

async function handleInboundMessage(
  supabase: Service,
  msg: MetaInboundMessage,
  contacts: { profile?: { name?: string }; wa_id?: string }[],
): Promise<void> {
  const waNumber = msg.from;
  const owner = await findOwnerByWhatsApp(supabase, waNumber);

  let caseId: string | null = null;
  if (owner) {
    caseId = await findActiveCaseId(supabase, owner.id);
    if (!caseId) {
      caseId = await openIntakeCase(supabase, owner.id);
    }
  }

  const media = extractInboundMedia(msg);
  const body =
    msg.text?.body ??
    msg.image?.caption ??
    msg.document?.caption ??
    `[${msg.type}]`;

  const { data: inserted } = await supabase
    .from("comms_messages")
    .insert({
      case_id: caseId,
      owner_id: owner?.id ?? null,
      channel: "whatsapp",
      direction: "inbound",
      thread_id: waNumber,
      whatsapp_message_id: msg.id,
      body,
      media_urls: media
        ? [{ media_id: media.media_id, mime: media.mime, filename: media.filename }]
        : [],
      status: "received",
      raw_payload: msg,
    })
    .select("id")
    .single();

  // Mark the matching webhook event row as processed + linked
  await supabase
    .from("whatsapp_webhook_events")
    .update({ processed: true, linked_comms_message_id: inserted?.id ?? null })
    .eq("whatsapp_message_id", msg.id)
    .eq("event_type", "message");

  // Profile-name backfill: if the contact profile carries a name and we have
  // an anonymous owner, persist it. Free signal we'd otherwise lose.
  const profileName = contacts.find((c) => c.wa_id === waNumber)?.profile?.name;
  if (owner && profileName && !owner.full_name) {
    await supabase.from("owners").update({ full_name: profileName }).eq("id", owner.id);
  }

  // Fan out: media → document-extract. Fire-and-forget, never block on it.
  if (media && caseId) {
    void dispatchDocumentExtract({
      case_id: caseId,
      owner_id: owner?.id ?? null,
      comms_message_id: inserted?.id ?? null,
      media_id: media.media_id,
      mime: media.mime,
      filename: media.filename ?? null,
    });
  }

  // Fan out: dispatch the Intake agent on text-only messages so it can drive
  // the next question. Fire-and-forget; agent runs in its own edge function.
  if (!media && caseId) {
    void dispatchIntake({ case_id: caseId, owner_id: owner?.id ?? null });
  }
}

async function handleStatusUpdate(
  supabase: Service,
  st: MetaStatusUpdate,
): Promise<void> {
  const patch: Record<string, unknown> = { status: st.status };
  const nowIso = new Date(Number(st.timestamp) * 1000).toISOString();
  if (st.status === "sent") patch.sent_at = nowIso;
  if (st.status === "delivered") patch.delivered_at = nowIso;
  if (st.status === "read") patch.read_at = nowIso;
  if (st.status === "failed") patch.error_message = st.errors?.[0]?.message ?? "failed";

  await supabase.from("comms_messages").update(patch).eq("whatsapp_message_id", st.id);
  await supabase
    .from("whatsapp_webhook_events")
    .update({ processed: true })
    .eq("whatsapp_message_id", st.id)
    .eq("event_type", "status");
}

// ---------- fire-and-forget edge-function dispatch ----------

interface DocumentExtractArgs {
  case_id: string;
  owner_id: string | null;
  comms_message_id: string | null;
  media_id: string;
  mime: string;
  filename: string | null;
}

async function dispatchDocumentExtract(args: DocumentExtractArgs): Promise<void> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return;
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/document-extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(args),
    });
  } catch (err) {
    console.error("document-extract dispatch failed:", (err as Error).message);
  }
}

interface IntakeArgs {
  case_id: string;
  owner_id: string | null;
}

async function dispatchIntake(args: IntakeArgs): Promise<void> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return;
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/agent-intake`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(args),
    });
  } catch (err) {
    console.error("agent-intake dispatch failed:", (err as Error).message);
  }
}
