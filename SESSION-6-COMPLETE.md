# Session 6 — Complete

**Shared agent runtime + intake-agent edge function + webhook → intake dispatch.
Refactor pass tightens the two execution agents (status_watchdog, exception_handler)
onto a single shared Deno helper; intake-agent is the first registry agent with
a live tool-use loop in production code.**

## Delivered

### 1. `supabase/functions/_shared/agent-runtime.ts` (new)

Shared helpers every Claude-driven edge function needs, deliberately narrow:

- **`anthropicChat()`** — single Messages API call with tools, strongly-typed
  response (`content`, `usage`, `stop_reason`). Throws typed `AnthropicError`
  on non-2xx so callers can decide 502 vs retry.
- **`toolUses()`** — filters content blocks to tool-use entries.
- **`tokenCost(model, inTok, outTok)`** — canonical pricing math keyed off the
  pinned family aliases (`claude-opus-4-7`, `claude-sonnet-4-6`,
  `claude-haiku-4-5`). Removes the duplicated `INPUT_PRICE_PER_M` /
  `OUTPUT_PRICE_PER_M` constants that lived in both execution agents and were
  Sonnet-pricing hard-coded (would have double-charged Haiku when intake came
  online).
- **`openRun()` / `closeRun()`** — `agent_runs` lifecycle with a single
  signature and sane defaults. Prevents the "forgot to set total_* on fail
  path" footgun that both agents had in slightly different shapes.
- **`clipToolResult()`** — the 8 KB tool-result cap, extracted from the
  exception-handler's inline `.slice(0, 8000)`.
- **`jsonResponse()` / `supaClient()`** — thin wrappers for parity with
  compliance-evaluate.

195 lines, no runtime deps beyond `jsr:@supabase/*` which the functions
already pull in.

### 2. `exception-handler-agent` refactored onto the shared helper

- Pricing / Supabase client / Anthropic call all go through `_shared`.
- Pricing is now model-correct (previously hard-coded Sonnet rates — fine
  today because the agent *is* Sonnet, but ready for the Opus override path
  without a silent 5× undercount).
- **Bug fix:** `terminal_reason` could be `null` when the loop hit
  `MAX_TURNS` without a terminal tool. Now stamps `budget_exhausted` so the
  row is diagnosable.
- Anthropic 5xx/overload now routes through `closeRun()` with the usage
  totals accrued up to the failure, instead of a bare `update()` that
  dropped them.
- Terminal execution lifted into a dedicated `executeTerminal()` function;
  `read_case_state` lifted into `readCaseState()`. The main `Deno.serve`
  handler is now a readable top-to-bottom flow.
- Behaviour identical on the wire: same tool manifest, same prompt, same
  terminal semantics, same `agent_turns` / `agent_messages` writes.

### 3. `status-watchdog-agent` refactored onto the shared helper

- Same imports as exception-handler, same pricing fix.
- `reasonAboutStaleCase()` now uses `toolUses()` + the typed Anthropic
  response, drops the local `JsonObj` dance.
- `dispatchExceptionHandler()` uses the shared `SUPABASE_URL` /
  `SUPABASE_SERVICE_ROLE_KEY` constants.
- Deterministic pre-filter, staleness thresholds, LLM-per-stale-case
  reasoning, and sweep bookkeeping are unchanged.

### 4. `supabase/functions/intake-agent/index.ts` (new)

The first **registry agent** to exist as a deployable Deno edge function.
Matches `lib/agents/intake.ts` (model, tools, terminal tools, budget).

Tool-use loop:
- Non-terminal: `send_reply`, `request_document`, `update_case_facts`,
  `update_pet_facts` — may fire mid-turn.
- Terminal: `ask_user_for_input` (one question per turn, yields),
  `handoff_to_compliance` (enqueues orchestrator_queue, transitions
  `cases.state → assessment`).
- Model: `claude-haiku-4-5`, 6-turn budget.

Side effects:
- Outbound messages insert `comms_messages` as `pending` and fire
  `whatsapp-send` fire-and-forget (same pattern as demo-stream v4).
- `update_pet_facts` creates the `pets` row on first write and links it
  back to the case.
- `ask_user_for_input` records the pending field as an `agent_messages`
  row (`subject: awaiting:<field>`) rather than demanding a schema change.
- `handoff_to_compliance` transitions state and enqueues to
  `orchestrator_queue` with `trigger_event: intake_complete`.

Context the agent sees: case snapshot, owner, pet (or null), last 10
WhatsApp turns in chronological order. Prompt enforces the AGENT.md capture
order and "warm, never breezy" tone from the markdown prompt.

### 5. `app/api/webhooks/whatsapp/route.ts` wired for intake

- Inbound message handler now reads the active case's `state` and
  `demo_mode`.
- When the case is in `draft` or `intake` (and not `demo_mode`), the
  webhook fires `intake-agent` fire-and-forget with a 2-second abort
  controller — Meta sees a 200 regardless.
- Unused `contacts` parameter renamed to `_contacts` for lint cleanliness.
- The TODO for Session 6b (media extraction) is still in place as a
  separate task.

## Verified

- `npm run typecheck` — 0 errors
- `npm run build` — 11 routes, all compile; edge runtime warnings unchanged
- Edge functions (Deno) share one helper and one pricing table; behaviour
  of the two existing agents is identical in the happy path and strictly
  improved on the two failure paths above.

## Still pending user action (unchanged from Session 5)

1. Revoke the leaked GitHub PAT from the chat log
2. Disable Vercel production Deployment Protection (Meta webhook delivery)
3. Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` on
   Vercel
4. Set `ANTHROPIC_API_KEY` on Supabase Edge Functions
5. Complete Meta sandbox onboarding (`WHATSAPP-ONBOARDING.md`) if you want
   real WhatsApps to fire during intake

Once these are set, deploy `intake-agent` and the refactored functions to
Supabase (`supabase functions deploy intake-agent status-watchdog-agent
exception-handler-agent`).

## Next session candidates

- **Session 7a — Document agent edge function**: port `lib/agents/document.ts`
  to a Deno function that reads a media_id (from an inbound WhatsApp),
  fetches the signed URL via `fetchWhatsAppMedia`, calls `extractDocument`,
  and writes `documents` + `pets` patches.
- **Session 7b — Orchestrator edge function**: consume `orchestrator_queue`
  and dispatch to intake / document / compliance / comms. Right now only
  the webhook fires intake directly; a real orchestrator would read the
  queue the webhook writes to and route by case state.
- **Session 7c — Compliance agent edge function**: port
  `lib/agents/compliance.ts` to Deno so `trigger_event: intake_complete`
  actually produces an assessment end-to-end.
- **Session 7d — Vet network / airline-crate / endorsement agents**: the
  three fulfillment agents listed in AGENT.md §3 are still just
  dramatized-demo names.
