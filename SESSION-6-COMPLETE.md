# Session 6 — Complete

**Refactor pass + Session 6a/6b wiring: inbound trigger flow and media extraction enqueue.**

## Refactored

### 1. Shared agent tool schemas → `lib/agents/tools.ts`

Three tool shapes were drifting across five agents. They now live in one module:

- `requestDocumentTool(kinds, opts)` — generates a `request_document` tool with the right `kind` enum and (for Comms) the `case_id` + `channel` fields. Intake, Compliance, Comms, and Specialist all import from here.
- `ASK_USER_FOR_INPUT_TOOL` — reused by Intake and Compliance.
- `ACKNOWLEDGE_AND_WAIT_TOOL` — reused by Orchestrator and Comms (Orchestrator's old inline schema had an unhelpful description; both now read identically).
- `OWNER_DOC_KINDS`, `COMPLIANCE_DOC_KINDS`, `SPECIALIST_DOC_KINDS` — the document-kind enums are stacked instead of duplicated.

### 2. Orchestrator case-budget exported as a constant

The orchestrator's description hard-coded "20 invocations, 500K tokens, 2 dissent rounds" while the `budget` field stored a different (per-invocation) cap. Both now derive from `ORCHESTRATOR_CASE_BUDGET`, and the per-invocation budget is commented inline so the distinction is obvious.

### 3. WhatsApp webhook — single-pass iteration

`app/api/webhooks/whatsapp/route.ts` previously walked `payload.entry → changes → value.messages/statuses` twice (once for audit, once for processing). The flow is now:

```
flattenWebhook(payload) → { messages, statuses }
                       → auditLog(events)
                       → process(events) [only if signature valid]
```

Also removed the dead ternary `(media ? '[${msg.type}]' : '[${msg.type}]')` and tightened the supabase service-client typing (`SupabaseClient` from the SDK instead of `ReturnType<typeof serviceClient>`).

## Built

### 4. `lib/queue.ts` — inter-agent task enqueue helper

Wraps `task_queue` inserts so callers don't need to know the row shape. Gracefully degrades to a warning when the table isn't present yet (Postgres `42P01` / PostgREST `PGRST205` codes both treated as a skip). Returns `{ ok, task_id, skipped, error }`.

Task types: `document_extract`, `intake`, `compliance`, `audit`, `comms`, `synthesize`.

### 5. Webhook now triggers two downstream flows (Session 6a/6b)

In `handleInboundMessage`:

- **Inbound media** → enqueues a `document_extract` task at high priority. Payload carries `comms_message_id`, `media_id`, `mime`, `filename` so the worker can claim and process within Meta's 5-minute signed-URL window.
- **First-touch from an unknown phone** → enqueues an `intake` task at high priority. Payload carries `whatsapp_number`, `profile_name` (from the Meta contacts block), and the `first_message` body. The Intake agent will create the owner+case on dequeue.

Both enqueues use `Promise.allSettled` semantics so the webhook still returns 200 within the deadline even if `task_queue` is missing or the insert fails.

### 6. `supabase/functions/document-extract` — worker edge function

Two invocation modes:

- `{ task_id }` — claim a queued task by id (atomic `UPDATE … WHERE status='pending'`), run, mark complete/failed.
- `{ comms_message_id, media_id, mime, case_id? }` — run inline. Useful for backfills or for the webhook to call directly when latency matters more than retry semantics.

On success: updates the originating `comms_messages.media_urls[0]` with `classification`/`confidence`/`extracted_fields`, and inserts a `documents` row when `case_id` is set so the compliance pipeline can consume it.

The vision call mirrors `lib/document-extract.ts` so the Next.js and Deno paths produce identical outputs.

## Verified

- `npx tsc --noEmit` — 0 errors
- `npx next build` — clean, 6 routes including `/api/webhooks/whatsapp`
- No new dependencies

## Pending user action (carried from Session 5)

1. 🔒 Revoke the GitHub PAT in the chat log
2. Apply the `task_queue` migration before deploying the document-extract worker (the webhook's enqueue is no-op until the table exists)
3. Set `ANTHROPIC_API_KEY` + `WHATSAPP_ACCESS_TOKEN` on the new document-extract edge function secrets
4. Deploy: `supabase functions deploy document-extract --project-ref yydnaisrgwiuuiespagi`

## Next session candidates

- **Session 7a — Intake worker loop**: the Intake agent definition exists (`lib/agents/intake.ts`) but no tool-loop runner has been written yet. With the queue enqueue now firing on first-touch, the worker can consume `intake` tasks and walk the conversation forward.
- **Session 7b — task_queue migration + dashboard**: small migration to land the table, plus a `/queue` page showing pending/running/completed tasks. Useful for ops.
- **Session 7c — Compliance worker loop**: same idea as 7a but for the compliance + auditor pair. Consumes `compliance` tasks, dispatches to `audit` on emit_assessment, escalates on dissent×2.
