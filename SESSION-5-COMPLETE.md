# Session 5 — Complete

**demo-stream → whatsapp-send wiring. Pitch demos now actually fire real WhatsApps when the target number is whitelisted; dramatized-mode still works cleanly when Meta creds are absent.**

## Delivered

### 1. `demo-stream` edge function v4 deployed to production

Project `yydnaisrgwiuuiespagi`, function id `fe775bbc-2349-460a-8808-0fef440e0a3d`, version 4 ACTIVE.

Key changes from v3:

- **Outbound WhatsApp steps now route through `whatsapp-send`** (fire-and-forget `fetch` to `/functions/v1/whatsapp-send`) instead of direct `comms_messages` inserts with `status='sent'`. `whatsapp-send` handles real Meta delivery when creds are present or falls back to stamping `wamid.DRAMATIZED_<uuid>` when not. The UI renders identically in both paths because both write to `comms_messages` — the only differences are the `whatsapp_message_id` prefix and whether a phone actually rang.
- **`target_whatsapp_number` in request body** (optional, E.164 with or without `+`). When provided at launch time, seeds the demo owner with this number instead of the `+971500000000` placeholder. Normalized via `normalizeE164()` to strip spaces/dashes.
- **`ownerId` tracked across the step loop.** Both phase 1 (seed) and phase 2 (tail — case already exists) resolve `owner_id` upfront so outbound-dispatch can pass it to `whatsapp-send`.
- **Inbound steps get `owner_id` + `thread_id`**; `status='received'` (was implicitly null). Inbound messages stay as direct inserts — they simulate the owner's side of the thread and never call `whatsapp-send` (which is outbound-only).
- **Model strings refreshed** on the `agent_logs` write: `claude-opus-4-7`, `claude-sonnet-4-6`, `ts-v1` — matches current Anthropic model family.
- Error isolation: `dispatchWhatsApp` is wrapped in its own try/catch and never throws into the step loop. A failed WhatsApp dispatch logs to Deno console but the demo keeps streaming.

### 2. Next.js proxy passes `target_whatsapp_number` through

`app/api/demo/stream/route.ts` forwards the new field to the edge function. Phase-2 tail calls also forward it (though edge function only uses it during the seed phase).

### 3. ControlPanel UI exposes the target number

`components/demo/ControlPanel.tsx`:
- New `targetWhatsapp` state (string; empty → `undefined` in request body).
- New input field below the speed selector inside the dramatized-mode section. `type="tel"` with an AE-formatted placeholder. Helper text explains the Meta-whitelist requirement.
- Cold control room styling: ink-900 bg, ink-700 border, amber focus ring, JetBrains Mono tabular-nums.

## How the pitch flow works now

1. **No Meta setup at all** — dramatized fallback. Messages stamped `wamid.DRAMATIZED_*`, WhatsAppPanel in the UI renders them as normal bubbles. This is the current state until Meta creds land.
2. **Meta sandbox set up, target number whitelisted** — Ahmed pastes the whitelisted number into the Target WhatsApp field → real WhatsApps land on that phone during the demo. Row status transitions `pending → sent` (eventually `delivered` / `read` via webhook).
3. **Meta sandbox set up, non-whitelisted number** — `whatsapp-send` calls Meta, Meta rejects with "recipient not in allowed list", row marked `status='failed'` with `error_message` populated. UI shows a failed badge next to that bubble.

All three paths keep the demo flowing — the step loop never blocks on whatsapp-send success.

## Verified

- Local `npx tsc --noEmit` — 0 errors
- Local `npx next build` — clean, 6 routes including `/api/webhooks/whatsapp`
- `demo-stream` v4 deployed and ACTIVE on production
- `whatsapp-send` v1 unchanged from Session 4

## Still pending user action (unchanged from previous sessions)

1. 🔒 Revoke the GitHub PAT in the chat log
2. Disable Vercel production Deployment Protection (blocker only for Meta's webhook POSTs; demo-stream → whatsapp-send works regardless)
3. Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` on Vercel (still needed for any Supabase calls from Next.js server-side)
4. Set `ANTHROPIC_API_KEY` on Supabase Edge Functions (for real-mode `compliance-evaluate`)
5. Optionally: complete Meta sandbox onboarding (`WHATSAPP-ONBOARDING.md`) — only needed if you want real WhatsApps to fire during the pitch rather than just the UI simulation

## Next session candidates

- **Session 6a — Webhook inbound trigger flow**: if a whitelisted owner WhatsApps the sandbox number, match by `whatsapp_number`, upsert case, trigger intake agent. Currently the webhook only persists inbound messages; it doesn't start a case.
- **Session 6b — Media extraction**: `handleInboundMessage` currently writes `media_urls` but doesn't run `extractDocument`. Add a `task_queue` enqueue + a `document-extract` edge function that consumes it. Meta's signed media URLs expire in 5 min so we need to fetch + extract inline or immediately after.
- **Session 6c — Rehearsal polish**: record end-to-end video of both demo scripts at 4× speed, fix any UI jank, optional custom domain + password-protect for staged private demos.
