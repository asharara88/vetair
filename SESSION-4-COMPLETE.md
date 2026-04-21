# Session 4 — Complete

**WhatsApp Business Cloud API integration — inbound webhook + outbound via Graph API + Claude Vision document extraction.**

## Delivered

### 1. Next.js webhook route
`app/api/webhooks/whatsapp/route.ts` — Node runtime, force-dynamic

- **GET** handler for Meta's one-time subscription challenge. Echoes `hub.challenge` iff `hub.verify_token` matches `WHATSAPP_VERIFY_TOKEN`.
- **POST** handler for message + status events:
  1. Reads raw body (needed for signature verification — cannot use `.json()`)
  2. Verifies `X-Hub-Signature-256` via HMAC-SHA256 with `WHATSAPP_APP_SECRET` and constant-time comparison
  3. Always audit-logs to `whatsapp_webhook_events` table with `signature_valid` flag — forensic trail even for invalid requests
  4. On valid signature: fans out to `handleInboundMessage` (writes to `comms_messages`, links owner by `whatsapp_number`, attaches active case if one exists) and `handleStatusUpdate` (updates sent/delivered/read/failed timestamps)
  5. Always returns 200 within deadline — Meta retries aggressively on non-200

### 2. WhatsApp client lib
`lib/whatsapp.ts` — shared between Next.js and edge functions

- `sendWhatsAppText(toE164, body)` — Graph API v21.0 POST
- `fetchWhatsAppMedia(mediaId)` — two-step (metadata + signed binary URL) for inbound media download
- `verifyMetaSignature(rawBody, header)` — HMAC-SHA256 with constant-time compare
- Full TypeScript types for Meta's webhook payload shape (`MetaWebhookPayload`, `MetaInboundMessage`, `MetaStatusUpdate`)
- `extractInboundMedia(msg)` convenience: pulls media_id/mime/filename/caption from any inbound message type

### 3. Supabase edge function `whatsapp-send`
Deployed at `https://yydnaisrgwiuuiespagi.supabase.co/functions/v1/whatsapp-send`

Two invocation modes:
- `{ comms_message_id }` — send an existing row
- `{ owner_id, body, case_id?, sent_by_agent? }` — create row + send

Idempotent: skips send if `whatsapp_message_id` already populated.

**Graceful fallback**: if Meta creds are absent, marks row as `status='sent'` with dramatized id `wamid.DRAMATIZED_<uuid>` — pitch demo runs regardless of Meta configuration.

### 4. Claude Vision document extractor
`lib/document-extract.ts`

- `extractDocument(bytes, mime)` — one Claude Sonnet 4 call, dual-purpose (classify + extract fields)
- Returns structured `ExtractedDocument` with pet_name, microchip_id, vaccine_name, dates, issuer, etc.
- Handles both image and PDF inputs (Sonnet 4 native PDF support, no Textract)
- Confidence capped by prompt at 0.9 for hand-written/obscured docs
- Strict JSON output, code-fence stripping, parse-error handling

### 5. Schema migration
`session4_whatsapp_schema` applied to production:

- `comms_messages` — added `raw_payload jsonb`, `error_message text`, `sent_at`, `delivered_at`, `read_at` timestamptz
- Added index on `whatsapp_message_id` (partial, where not null)
- New `whatsapp_webhook_events` table with full forensic schema: signature_valid, event_type, from_phone, payload, processed, processing_error, linked_comms_message_id FK
- Indexes on `received_at DESC`, `from_phone`, and partial on unprocessed
- RLS enabled with permissive `all_access` policy (matches session 1 convention)
- Index on `owners.whatsapp_number` for fast inbound lookup

### 6. Onboarding doc
`WHATSAPP-ONBOARDING.md` — step-by-step Meta setup: create app, add WhatsApp product, grab phone ID + access token + app secret, whitelist test numbers, configure webhook URL, verify token pairing, set env vars on both Vercel and Supabase, smoke test inbound + outbound, security notes, cost breakdown for pitch/pilot/production tiers.

## Verified

- Local `npx tsc --noEmit` — 0 errors
- Local `npx next build` — 14.2s clean build, 6 routes including `/api/webhooks/whatsapp`
- Edge function `whatsapp-send` deployed, v1 ACTIVE on project `yydnaisrgwiuuiespagi`
- Migration `session4_whatsapp_schema` applied (10 DDL statements)

## Still pending user action

- Set `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` on Vercel (see onboarding doc)
- Set `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` on Supabase Edge Function secrets
- Register webhook URL `/api/webhooks/whatsapp` in Meta app config
- Whitelist up to 5 test recipient numbers in Meta sandbox

## Known TODO for later sessions

1. **Media processing enqueue** — `handleInboundMessage` writes `media_urls: [{ media_id, mime, filename }]` but does not yet enqueue a `task_queue` row for the Document Agent to pick up. Currently flagged with a TODO comment.
2. **Signed-URL expiration** — Meta's media signed URLs expire in 5 minutes. Document extraction should run from the webhook path or immediately after, not deferred indefinitely. When we build the Document Agent worker, it should fetch+extract inline rather than relying on stored URLs.
3. **Interactive messages** — current `whatsapp-send` only handles plain text. Session 4.5 could add button/list/template support (e.g., "approve this crate quote" → button response).
4. **Rate limiting** — Meta throttles at 80 msg/sec per phone number by default. For a pitch this doesn't matter, but production should batch and back off.
