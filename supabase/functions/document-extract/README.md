# document-extract

Consumes a `task_queue` row of type `document_extract`, fetches the media bytes from Meta's signed URL, runs a single Claude Sonnet 4 vision call (classify + extract), and persists the structured fields.

## Invocation

```bash
# By task id (claimed from task_queue)
curl -X POST https://yydnaisrgwiuuiespagi.supabase.co/functions/v1/document-extract \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"task_id": "<uuid>"}'

# Inline (no queue) — for backfills or direct calls from the webhook
curl -X POST https://yydnaisrgwiuuiespagi.supabase.co/functions/v1/document-extract \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "comms_message_id": "<uuid>",
    "media_id": "<meta_media_id>",
    "mime": "image/jpeg",
    "case_id": "<uuid optional>"
  }'
```

## Env vars

- `ANTHROPIC_API_KEY` — vision call
- `WHATSAPP_ACCESS_TOKEN` — Meta media download
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — automatically set by Supabase

## Side effects

1. Updates `comms_messages.media_urls[0]` with `classification`, `confidence`, `extracted_fields`.
2. Inserts a `documents` row when `case_id` is set so the compliance pipeline can consume it.
3. On task-id mode: marks the `task_queue` row `completed` (or `failed` with `error_message`).

## Note on signed URLs

Meta media signed URLs expire ~5 minutes after issuance. The webhook enqueues at high priority for this reason — a worker picking this task up late will get a `Binary fetch HTTP 401`.
