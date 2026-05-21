// WhatsApp Business webhook endpoint.
// URL that Meta will call: https://<your-vercel-domain>/api/webhooks/whatsapp
//
// - GET: Meta's one-time subscription challenge. We echo hub.challenge iff the
//   hub.verify_token matches our env var.
// - POST: message events (incoming messages, delivery/read receipts). We verify
//   the X-Hub-Signature-256 against WHATSAPP_APP_SECRET, persist the raw
//   payload to whatsapp_webhook_events for audit, then fan out to comms_messages
//   and (for media) enqueue async document extraction. We ALWAYS return 200
//   within a few seconds — Meta retries aggressively on non-200.

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
import { enqueueTask } from "@/lib/queue";

export const runtime = "nodejs"; // need Web Crypto + service role
export const dynamic = "force-dynamic";

type Contact = { profile?: { name?: string }; wa_id?: string };

interface FlattenedEvents {
  messages: Array<{ msg: MetaInboundMessage; contacts: Contact[] }>;
  statuses: MetaStatusUpdate[];
}

function serviceClient() {
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
    return new Response(challenge ?? "", { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new Response("forbidden", { status: 403 });
}

// ---------- POST: message + status events ----------
export async function POST(req: NextRequest) {
  // We MUST read the raw body for signature verification — Next.js parses JSON
  // automatically if we call .json(), but the HMAC must be computed over the
  // exact bytes Meta sent us. Read as text, then JSON.parse ourselves.
  const raw = await req.text();
  const signatureValid = await verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"));

  let payload: MetaWebhookPayload = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    // Not JSON. Still 200 so Meta doesn't retry garbage forever.
    return new Response("ok", { status: 200 });
  }

  const events = flattenWebhook(payload);
  const supabase = serviceClient();

  // Always audit-log first, even if signature is invalid — we want forensic
  // trail for every hit to this endpoint.
  await auditLog(supabase, payload, events, signatureValid);

  // If the signature is bad, we've audited the attempt but refuse to act on it.
  if (!signatureValid) return new Response("ok", { status: 200 });

  // Process the events. We do this inline but fast: the slow work (doc
  // extraction via Claude Vision) is enqueued as a task_queue row that a
  // worker picks up later.
  const work: Promise<unknown>[] = [
    ...events.messages.map(({ msg, contacts }) => handleInboundMessage(supabase, msg, contacts)),
    ...events.statuses.map((st) => handleStatusUpdate(supabase, st)),
  ];
  await Promise.allSettled(work);

  return new Response("ok", { status: 200 });
}

// ---------- helpers ----------

function flattenWebhook(payload: MetaWebhookPayload): FlattenedEvents {
  const out: FlattenedEvents = { messages: [], statuses: [] };
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const contacts = value.contacts ?? [];
      for (const msg of value.messages ?? []) out.messages.push({ msg, contacts });
      for (const st of value.statuses ?? []) out.statuses.push(st);
    }
  }
  return out;
}

async function auditLog(
  supabase: SupabaseClient,
  payload: MetaWebhookPayload,
  events: FlattenedEvents,
  signatureValid: boolean,
) {
  const rows: Array<Record<string, unknown>> = [
    ...events.messages.map(({ msg }) => ({
      signature_valid: signatureValid,
      event_type: "message",
      from_phone: msg.from,
      whatsapp_message_id: msg.id,
      payload: msg,
      processed: false,
    })),
    ...events.statuses.map((st) => ({
      signature_valid: signatureValid,
      event_type: "status",
      from_phone: st.recipient_id,
      whatsapp_message_id: st.id,
      payload: st,
      processed: false,
    })),
  ];
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

async function handleInboundMessage(
  supabase: SupabaseClient,
  msg: MetaInboundMessage,
  contacts: Contact[],
) {
  // Find owner by whatsapp_number. Meta sends E.164 without the leading `+`,
  // but our seed data sometimes stores it with one — match either form.
  const waNumber = msg.from;
  const { data: owner } = await supabase
    .from("owners")
    .select("id, full_name")
    .or(`whatsapp_number.eq.${waNumber},whatsapp_number.eq.+${waNumber}`)
    .maybeSingle();

  // Active case for the owner (most recent open).
  const caseId = owner?.id ? await findActiveCase(supabase, owner.id) : null;

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

  // Mark the matching webhook event row as processed + linked.
  await supabase
    .from("whatsapp_webhook_events")
    .update({ processed: true, linked_comms_message_id: inserted?.id ?? null })
    .eq("whatsapp_message_id", msg.id)
    .eq("event_type", "message");

  // Inter-agent dispatch — fire-and-forget enqueues.
  // (Failures are logged inside enqueueTask; they never block the webhook 200.)
  if (media && inserted?.id) {
    await enqueueTask(supabase, {
      source_agent: "webhook",
      target_agent: "document",
      task_type: "document_extract",
      case_id: caseId,
      priority: "high",
      payload: {
        comms_message_id: inserted.id,
        media_id: media.media_id,
        mime: media.mime,
        filename: media.filename ?? null,
      },
    });
  }

  // First-touch from an unknown number → start an intake conversation.
  if (!owner) {
    const profileName = contacts.find((c) => c.wa_id === waNumber)?.profile?.name ?? null;
    await enqueueTask(supabase, {
      source_agent: "webhook",
      target_agent: "intake",
      task_type: "intake",
      priority: "high",
      payload: {
        whatsapp_number: waNumber,
        profile_name: profileName,
        first_message: body,
        first_message_id: msg.id,
      },
    });
  }
}

async function findActiveCase(supabase: SupabaseClient, ownerId: string): Promise<string | null> {
  const { data } = await supabase
    .from("cases")
    .select("id")
    .eq("owner_id", ownerId)
    .not("state", "in", "(closed,cancelled)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function handleStatusUpdate(supabase: SupabaseClient, st: MetaStatusUpdate) {
  const patch: Record<string, unknown> = { status: st.status };
  const nowIso = new Date(Number(st.timestamp) * 1000).toISOString();
  if (st.status === "sent") patch.sent_at = nowIso;
  if (st.status === "delivered") patch.delivered_at = nowIso;
  if (st.status === "read") patch.read_at = nowIso;
  if (st.status === "failed") patch.error_message = st.errors?.[0]?.message ?? "failed";

  await supabase
    .from("comms_messages")
    .update(patch)
    .eq("whatsapp_message_id", st.id);

  await supabase
    .from("whatsapp_webhook_events")
    .update({ processed: true })
    .eq("whatsapp_message_id", st.id)
    .eq("event_type", "status");
}
