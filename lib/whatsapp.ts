// WhatsApp Business Cloud API helper — outbound messages and signature verification.
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
//
// Env vars required (set on Vercel + Supabase Edge):
//   WHATSAPP_PHONE_NUMBER_ID   — the Meta phone number ID to send FROM
//   WHATSAPP_ACCESS_TOKEN      — Meta system user token (long-lived)
//   WHATSAPP_APP_SECRET        — used to verify X-Hub-Signature-256 on inbound
//   WHATSAPP_VERIFY_TOKEN      — any string you set; Meta echoes it during setup

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface SendTextResult {
  ok: boolean;
  whatsapp_message_id?: string;
  error?: string;
}

export async function sendWhatsAppText(
  toE164: string,
  body: string,
): Promise<SendTextResult> {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) {
    return { ok: false, error: "WhatsApp credentials not configured" };
  }

  const res = await fetch(`${GRAPH_BASE}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toE164.replace(/^\+/, ""),
      type: "text",
      text: { preview_url: false, body },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data?.error?.message || `HTTP ${res.status}` };
  }
  return { ok: true, whatsapp_message_id: data?.messages?.[0]?.id };
}

// Download an inbound media object's bytes. Meta gives us a media_id; we ask
// the Graph API for the signed URL, then fetch the bytes separately.
export async function fetchWhatsAppMedia(
  mediaId: string,
): Promise<{ ok: true; bytes: ArrayBuffer; mime: string } | { ok: false; error: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) return { ok: false, error: "WhatsApp token not configured" };

  const metaRes = await fetch(`${GRAPH_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) return { ok: false, error: `Meta media lookup HTTP ${metaRes.status}` };
  const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
  if (!meta.url) return { ok: false, error: "No url in media metadata" };

  const bin = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!bin.ok) return { ok: false, error: `Binary fetch HTTP ${bin.status}` };
  return { ok: true, bytes: await bin.arrayBuffer(), mime: meta.mime_type ?? "application/octet-stream" };
}

// Verify Meta's X-Hub-Signature-256 header against the raw request body.
// Meta signs as: "sha256=" + HMAC_SHA256(app_secret, raw_body_bytes)
export async function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return false;

  const match = /^sha256=([0-9a-f]+)$/i.exec(signatureHeader);
  if (!match) return false;
  const expectedHex = match[1].toLowerCase();

  // Web Crypto API — available on Node 20+, Edge runtime, Deno
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const actualHex = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time compare to resist timing attacks
  if (expectedHex.length !== actualHex.length) return false;
  let diff = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    diff |= expectedHex.charCodeAt(i) ^ actualHex.charCodeAt(i);
  }
  return diff === 0;
}

// Shape of a Meta webhook POST body (subset we care about).
export interface MetaWebhookPayload {
  object?: string;
  entry?: {
    id?: string;
    changes?: {
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        contacts?: { profile?: { name?: string }; wa_id?: string }[];
        messages?: MetaInboundMessage[];
        statuses?: MetaStatusUpdate[];
      };
    }[];
  }[];
}

export interface MetaInboundMessage {
  id: string;
  from: string; // E.164 without +
  timestamp: string;
  type: "text" | "image" | "document" | "audio" | "video" | "sticker" | "location" | "contacts" | "interactive" | "button" | "reaction";
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  document?: { id: string; mime_type: string; sha256: string; filename?: string; caption?: string };
  audio?: { id: string; mime_type: string; voice?: boolean };
  video?: { id: string; mime_type: string; caption?: string };
}

export interface MetaStatusUpdate {
  id: string;             // the whatsapp_message_id we sent
  recipient_id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  errors?: { code: number; title: string; message?: string }[];
}

// Convenience: pull media id + mime + a human label out of any inbound message
export function extractInboundMedia(msg: MetaInboundMessage): {
  media_id: string;
  mime: string;
  filename?: string;
  caption?: string;
} | null {
  if (msg.image) return { media_id: msg.image.id, mime: msg.image.mime_type, caption: msg.image.caption };
  if (msg.document) return { media_id: msg.document.id, mime: msg.document.mime_type, filename: msg.document.filename, caption: msg.document.caption };
  return null;
}
