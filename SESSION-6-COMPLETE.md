# Session 6 — Complete

**Webhook → document-extract wiring + auto-open intake case on inbound contact. The MAS now reacts to inbound WhatsApp media end-to-end: webhook persists, extracts via Claude Vision, and backfills the pet record — all fire-and-forget so Meta still gets its 200 within the SLA.**

## Delivered

### 1. `supabase/functions/document-extract` edge function

New function. Fetches a Meta media object, runs Claude Sonnet 4 vision over it, persists a `documents` row, and backfills any safe pet fields (`microchip_id`, `date_of_birth`, `breed`, `species`, `name`) that were still null. Existing values are never overwritten — that stays an orchestrator decision once a Compliance/Auditor mismatch is flagged.

- Synchronous extraction (Meta's signed media URLs expire after ~5 min so queueing isn't safe).
- Always returns HTTP 200 — failures are recorded in `agent_logs.error_message`, never as a non-200 that Meta would retry.
- Cost + latency end up in `agent_logs` so the Factory page picks them up.
- Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_ACCESS_TOKEN`, `ANTHROPIC_API_KEY`, optional `ANTHROPIC_VISION_MODEL`.

### 2. `app/api/webhooks/whatsapp/route.ts` rewired

- **Auto-opens an intake case** when an inbound WhatsApp arrives from a known owner with no active case. The Intake agent then drives the next questions. Anonymous senders stay anonymous — we do not create owner rows from the webhook.
- **Fans out to `document-extract`** (fire-and-forget) whenever an inbound message carries media. Resolves the long-standing TODO in `handleInboundMessage`.
- **Fans out to `agent-intake`** (fire-and-forget, also new function — call site is there even if the function isn't yet deployed) on text-only inbound to drive the next intake turn.
- **Backfills `owners.full_name`** from the contact profile when the row is anonymous. Free signal we'd otherwise lose.
- **Refactored** into `auditLog`, `findOwnerByWhatsApp`, `findActiveCaseId`, `openIntakeCase`, `handleInboundMessage`, `handleStatusUpdate`, plus typed `dispatchDocumentExtract` / `dispatchIntake`. Replaces the previous monolithic body.
- **Fixed dead branch** in `body` derivation: the old form `(media ? \`[${msg.type}]\` : \`[${msg.type}]\`)` returned the same string on both legs.

### 3. Agent helper tightening

- `lib/agents/compliance.ts`: shared read-tools and `emit_assessment` now type as `AgentTool[]` / `AgentTool` instead of repeating `"object" as const` four times.
- `lib/agents/types.ts`: `validateAgent` also detects duplicate tool names within an agent (not just terminal_tools ⊄ tools).
- `lib/agents/index.ts`: explicit loop over `STATIC_AGENTS` instead of `Object.fromEntries` — fails loudly on duplicate agent names at module load.

## Verified

- `npx tsc --noEmit` — 0 errors
- `npx next build` — clean, 11 routes including `/api/webhooks/whatsapp`
- `supabase/functions/document-extract/` self-contained Deno function; deploys with `supabase functions deploy document-extract`

## Pending deployment

1. Deploy `document-extract` to project `yydnaisrgwiuuiespagi`.
2. Set the function's env vars on Supabase Edge (`ANTHROPIC_API_KEY`, `WHATSAPP_ACCESS_TOKEN`).
3. Verify the webhook can reach it (same project, same service role — no additional auth setup needed).
4. (Optional) Build `agent-intake` edge function so the text-only dispatch path actually does something. The call site is wired; the function isn't.

## Next session candidates

- **Session 7a — `agent-intake` edge function**: consume the dispatch from the webhook, run an Intake tool-use loop, write next-question outbound via `whatsapp-send`. Closes the inbound→outbound loop.
- **Session 7b — Compliance dispatch on document arrival**: when the document classification is `rabies_certificate` or similar and the case is in `intake` state, evaluate whether all required fields are present and, if so, transition to `assessment` + dispatch the Compliance agent.
- **Session 7c — Mismatch surfacing**: when extraction reports a value that disagrees with `pets` (rather than just a missing field), write a `case_events` row so the orchestrator can decide whether to ask the owner or trust the doc.
