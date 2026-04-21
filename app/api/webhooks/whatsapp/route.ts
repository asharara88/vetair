// WhatsApp Business webhook endpoint.
// URL that Meta will call: https://<your-vercel-domain>/api/webhooks/whatsapp
//
// - GET: Meta's one-time subscription challenge. We echo hub.challenge iff the
//   hub.verify_token matches our env var.
// - POST: message events (incoming messages, delivery/read receipts). We verify
//   the X-Hub-Signature-256 against WHATSAPP_APP_SECRET, persist the raw
//   payload to whatsapp_webhook_events for audit, then fan out to comms_messages
//   and (for media) trigger async document extraction. We ALWAYS return 200
//   within a few seconds — Meta retries aggressively on non-200.

import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
  const signatureHeader = req.headers.get("x-hub-signature-256");
  const signatureValid = await verifyMetaSignature(raw, signatureHeader);

  let payload: MetaWebhookPayload = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    // not JSON — still 200 so Meta doesn't retry garbage forever
    return new Response("ok", { status: 200 });
  }

  // Always audit-log first, even if signature is invalid — we want forensic
  // trail for every hit to this endpoint.
  const supabase = serviceClient();
  const eventRows: Array<Record<string, unknown>> = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      for (const msg of value.messages ?? []) {
        eventRows.push({
          signature_valid: signatureValid,
          event_type: "message",
          from_phone: msg.from,
          whatsapp_message_id: msg.id,
          payload: msg,
          processed: false,
        });
      }
      for (const st of value.statuses ?? []) {
        eventRows.push({
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
  if (eventRows.length === 0) {
    eventRows.push({
      signature_valid: signatureValid,
      event_type: "unknown",
      payload,
      processed: false,
    });
  }
  await supabase.from("whatsapp_webhook_events").insert(eventRows);

  // If the signature is bad, we've audited the attempt but refuse to act on it.
  if (!signatureValid) {
    return new Response("ok", { status: 200 });
  }

  // Signature valid — process the events. We do this inline but fast: the
  // slow work (doc extraction via Claude Vision) is enqueued async and not
  // awaited here.
  const work: Promise<unknown>[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      for (const msg of value.messages ?? []) {
        work.push(handleInboundMessage(supabase, msg, value.contacts ?? []));
      }
      for (const st of value.statuses ?? []) {
        work.push(handleStatusUpdate(supabase, st));
      }
    }
  }
  // Await so we're honest about any DB write failure, but keep the deadline tight.
  await Promise.allSettled(work);

  return new Response("ok", { status: 200 });
}

async function handleInboundMessage(
  supabase: ReturnType<typeof serviceClient>,
  msg: MetaInboundMessage,
  contacts: { profile?: { name?: string }; wa_id?: string }[],
) {
  // Find owner by whatsapp_number (Meta sends E.164 without leading +)
  const waNumber = msg.from;
  const { data: owner } = await supabase
    .from("owners")
    .select("id, full_name")
    .or(`whatsapp_number.eq.${waNumber},whatsapp_number.eq.+${waNumber}`)
    .maybeSingle();

  // Find active case for that owner (most recent open case)
  let caseId: string | null = null;
  if (owner?.id) {
    const { data: activeCase } = await supabase
      .from("cases")
      .select("id")
      .eq("owner_id", owner.id)
      .not("state", "in", "(closed,cancelled)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    caseId = activeCase?.id ?? null;
  }

  const media = extractInboundMedia(msg);
  const body =
    msg.text?.body ??
    msg.image?.caption ??
    msg.document?.caption ??
    (media ? `[${msg.type}]` : `[${msg.type}]`);

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
      media_urls: media ? [{ media_id: media.media_id, mime: media.mime, filename: media.filename }] : [],
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

  // TODO (Session 4.5): if media is present, enqueue a task_queue row for the
  // Document Agent to run Claude Vision extraction. For now we only persist.
}

async function handleStatusUpdate(
  supabase: ReturnType<typeof serviceClient>,
  st: MetaStatusUpdate,
) {
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
