# Session 6 — Complete

**Roster expansion + lib/agents cleanup. Three new MAS agents (Vet Network, Endorsement Desk, Airline & Crate) wired into the registry. Shared tool schemas extracted so the per-agent files stop drifting.**

## Delivered

### 1. `lib/agents/shared.ts` — single source of truth for cross-agent enums

Centralized fragments that previously diverged across agent files:

- `MODEL_IDS` — derived from the `ModelId` type, used by Synthesizer's `register_specialist` enum.
- `BASE_DOCUMENT_KINDS` (intake) ⊂ `COMPLIANCE_DOCUMENT_KINDS` ⊂ `SPECIALIST_DOCUMENT_KINDS` — three nesting tiers so intake doesn't offer endorsements before compliance has assessed.
- `OUTBOUND_CHANNELS` (whatsapp/email/sms) and `TEMPLATED_CHANNELS` (whatsapp/email).
- `requestDocumentTool(kinds, opts)` factory — produces the two shapes the codebase used (with vs without `case_id`+`channel`).
- Tool constants `ASK_USER_FOR_INPUT_TOOL`, `ACKNOWLEDGE_AND_WAIT_TOOL`, `READ_CASE_TOOL` referenced verbatim by 3+ agents.

### 2. New agents

```
lib/agents/vet_network.ts  + lib/prompts/vet_network.md
lib/agents/endorsement.ts  + lib/prompts/endorsement.md
lib/agents/airline.ts      + lib/prompts/airline.md
```

- **Vet Network** (`claude-haiku-4-5`): finds a partner clinic licensed to endorse for the destination corridor and proposes a slot. Terminal: `propose_appointment` / `no_match` / `acknowledge_and_wait`.
- **Endorsement Desk** (`claude-haiku-4-5`): submits the signed health certificate to USDA-APHIS / DEFRA / MOCCAE / CFIA, polls status, persists the endorsed PDF. Terminal: `submit_to_authority` / `record_endorsement` / `fail_endorsement` / `acknowledge_and_wait`. Idempotent on `(case_id, document_id)`.
- **Airline & Crate** (`claude-sonnet-4-6`): IATA LAR §8 crate sizing (PP10..PP100) + breed-restriction-aware airline booking. Reads `breed_restrictions` BEFORE `list_airlines` so brachycephalic/snub-nose blocks short-circuit cleanly. Terminal: `recommend_crate` / `book_cargo_slot` / `blocked_by_breed` / `acknowledge_and_wait`.

### 3. Registry wiring

- `AgentType` extended in `registry-meta.ts` with `vet_network | endorsement | airline`. Tone/order/blurb tables updated.
- `STATIC_AGENTS` in `lib/agents/index.ts` now includes all three; ordering matches the operational flow (intake → document → compliance → auditor → vet_network → endorsement → airline → comms → synthesizer).
- `AGENT_META` in `lib/utils.ts` updated with display labels + accent colors.
- `TERMINAL_TONE` extended with the new terminal tools so timeline pills color correctly (`propose_appointment` → go, `no_match` → stop, `submit_to_authority` → amber, etc).

### 4. Refactor of existing agents

- `intake.ts`, `compliance.ts`, `specialist.ts`, `comms.ts` now consume `requestDocumentTool()` instead of inlining the kind enum 4× (which had drifted: intake had 4 kinds, compliance had 6, specialist had 7).
- `orchestrator.ts` reuses `READ_CASE_TOOL` and `ACKNOWLEDGE_AND_WAIT_TOOL` instead of duplicating their shapes.
- `synthesizer.ts` reuses `MODEL_IDS` rather than re-listing `claude-opus-4-7 / claude-sonnet-4-6 / claude-haiku-4-5`.
- `comms.ts` reads `OUTBOUND_CHANNELS` from shared rather than literal.
- `compliance.ts` lost ~30 lines via `ASK_USER_FOR_INPUT_TOOL` reuse and `requestDocumentTool()`.

## Verified

- `npx tsc --noEmit` — 0 errors
- `npx next build` (Next 16 / Turbopack) — clean, 11 routes, 4.2s compile

## Net code change

```
 lib/agents/airline.ts          | +120 (new)
 lib/agents/endorsement.ts      |  +99 (new)
 lib/agents/vet_network.ts      |  +75 (new)
 lib/prompts/airline.md         |  +30 (new)
 lib/prompts/endorsement.md     |  +27 (new)
 lib/prompts/vet_network.md     |  +24 (new)
 lib/agents/shared.ts           | +112 (new)
 lib/agents/comms.ts            |  -25 (refactor)
 lib/agents/compliance.ts       |  -27 (refactor)
 lib/agents/intake.ts           |  -10 (refactor)
 lib/agents/orchestrator.ts     |  -19 (refactor)
 lib/agents/specialist.ts       |  -10 (refactor)
 lib/agents/synthesizer.ts      |   -2 (refactor)
 lib/agents/registry-meta.ts    |  +16 (3 new types)
 lib/agents/index.ts            |  +21 (3 new agents + shared re-exports)
 lib/utils.ts                   |  +14 (AGENT_META + TERMINAL_TONE)
```

## Still pending

Same as Session 5 — the WhatsApp env vars, Anthropic key on Supabase, and Meta sandbox onboarding are unchanged. The new agents are scaffolded with their tool schemas and prompts; the Supabase `agent_registry` rows + tool dispatchers for `find_partner_vets`, `submit_to_authority`, `list_airlines` etc are the next backend session.

## Next session candidates

- **Session 7 — Backend dispatchers**: Implement the tool-handler edge functions for the new agents — `partner_vets` table + `find_partner_vets` query, `endorsement_submissions` table + USDA-APHIS adapter stub, `airlines` + `breed_restrictions` tables + IATA crate sizing function. Without these, the agents are tool-schema-only.
- **Session 6a (carried)**: Webhook inbound trigger flow — match by `whatsapp_number`, upsert case, dispatch to intake.
- **Session 6b (carried)**: Media extraction enqueue + `document-extract` edge function.
