# document-extract

Fetches an inbound WhatsApp media object from Meta, runs Claude Sonnet 4 vision over it, persists a `documents` row, and backfills any safe pet fields that were missing.

Triggered fire-and-forget by `app/api/webhooks/whatsapp/route.ts` whenever an inbound message carries an image or document. Meta's signed media URLs expire after ~5 minutes so we extract synchronously rather than queueing.

## Invocation

```bash
curl -X POST \
  https://yydnaisrgwiuuiespagi.supabase.co/functions/v1/document-extract \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "case_id": "<uuid>",
    "owner_id": "<uuid>",
    "comms_message_id": "<uuid>",
    "media_id": "<meta-media-id>",
    "mime": "image/jpeg",
    "filename": "rabies.pdf"
  }'
```

## Env vars

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `WHATSAPP_ACCESS_TOKEN` — Meta system-user token (long-lived)
- `ANTHROPIC_API_KEY` — Claude API key
- `ANTHROPIC_VISION_MODEL` (optional) — defaults to `claude-sonnet-4-6`

## Side effects

- Inserts one `documents` row with `classification`, `extracted_fields`, `extraction_confidence`, token counts.
- Optionally patches `pets` with `microchip_id`, `date_of_birth`, `breed`, `species`, `name` — only where the existing value is null. Never overwrites a populated field; mismatches are a Compliance/Auditor decision.
- Inserts one `agent_logs` row (`agent_name = "document"`) so the run shows up on the Factory page with cost + latency.

## Failure modes

Always returns HTTP 200 with `{ ok: false, error }`. The webhook dispatches fire-and-forget so we never want a non-200 to look like a retryable Meta error. Failures are recorded in `agent_logs.error_message` for forensics.
