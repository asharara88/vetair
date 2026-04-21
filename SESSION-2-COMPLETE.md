# Session 2 — COMPLETE

Deployed and verified on Supabase project `yydnaisrgwiuuiespagi`:

## ✅ Deliverables

### 1. Deterministic TypeScript compliance engine
- File: `lib/compliance/evaluators.ts` (for Next.js import)
- Mirror: `supabase/functions/compliance-evaluate/compliance_engine.ts`
- 12 registered evaluator functions
- No LLM, no ambiguity
- Acts as Voice #1 in the three-voice spine

### 2. Edge Function: `compliance-evaluate` — Three-voice spine
- **Status: ACTIVE, v2, verify_jwt=false**
- Orchestrates:
  1. Deterministic TS engine (free, instant)
  2. Claude Sonnet 4 primary (~$0.005/call)
  3. Claude Opus 4.7 adversarial auditor (~$0.015/call)
- Writes `consensus_rounds`, `requirement_evaluations`, `agent_logs`
- Updates `cases.state` and `cases.earliest_legal_departure`
- See `supabase/functions/compliance-evaluate/README.md` for invocation

### 3. Edge Function: `demo-stream` — SSE streaming runner
- **Status: ACTIVE, v2, verify_jwt=false**
- Streams any row from `demo_scripts` as authentic-looking live events
- Writes to same tables as real-case-mode (UI cannot tell the difference)
- Seeds owner+pet+case if not supplied
- See `supabase/functions/demo-stream/README.md` for invocation

### 4. Edge Function: `compliance-audit` — Standalone auditor (legacy)
- **Status: ACTIVE, v1** — stub from earlier iteration
- Can be left in place or removed; current architecture does auditor voice inside `compliance-evaluate`

## 🔑 Required env var

**Action needed:** Set `ANTHROPIC_API_KEY` on the Supabase project:
→ https://supabase.com/dashboard/project/yydnaisrgwiuuiespagi/settings/functions

Without this, `compliance-evaluate` will return 500 in real-case-mode (demo-stream still works fine).

## 📊 Verification

Both functions callable via:
```
https://yydnaisrgwiuuiespagi.supabase.co/functions/v1/compliance-evaluate
https://yydnaisrgwiuuiespagi.supabase.co/functions/v1/demo-stream
```

---

## → Session 3 preview

**Goal:** Next.js 15 UI — demo control panel, live agent chatter, three-voice panel, WhatsApp-style panel, case state machine.

Will build:
- `package.json`, `next.config.js`, `tsconfig.json`, `tailwind.config.ts`
- `app/layout.tsx` + `app/globals.css` (brand tokens from logo bucket)
- `app/page.tsx` — landing / demo control panel
- `app/cases/[id]/page.tsx` — live case view (the pitch centerpiece)
- `components/demo/ControlPanel.tsx`, `AgentChatter.tsx`, `ThreeVoicePanel.tsx`, `ConsensusTimeline.tsx`, `WhatsAppPanel.tsx`, `CaseStateMachine.tsx`, `RequirementMatrix.tsx`
- `lib/supabase.ts`, `types/database.ts`
- Deploy to Vercel, wire env vars

Estimated: one sitting.

---

## → Session 4 preview

**Goal:** WhatsApp Business API sandbox wiring + real inbound handling.

Will build:
- Meta for Developers onboarding (sandbox number)
- `app/api/webhooks/whatsapp/route.ts` (verify + receive)
- Media-message handling (document uploads trigger Claude vision extraction)
- Outbound message sending via Graph API
- 5-test-number sandbox limit handling
- Fallback: the visual WhatsApp panel we build in Session 3 stays as a second-screen option

---

## → Session 5 preview

**Goal:** End-to-end dry run + polish for pitch.

- Run both demo scripts end-to-end, record video
- Fix any UI jank
- Optional: brand polish (logo placement, color tokens, motion design)
- Optional: staging Vercel deployment behind password
