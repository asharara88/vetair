# Session 3 — COMPLETE

## ✅ Shipped: complete Next.js 15 pitch cockpit

### Tech stack locked

- **Next.js 15.0.3** App Router on **React 19 RC**
- **Supabase SSR 0.5.2** for browser + server client factories, realtime subscriptions
- **Tailwind 3.4** with hand-built Vetair design system
- **TypeScript strict mode**, path aliases, hand-written types matching DB schema
- Target: **Vercel edge runtime** for API routes (nodejs for `/api/cases` since it uses service role key)

### Design language — "Cold control room"

Deliberate aesthetic: refined, technical, slightly detached. Not a consumer app — a trading-desk-grade instrument that happens to move pets. Specifically:

- **Palette:** 12-shade ink neutrals (#07090c → #f5f7fa) + 4 signal colors (go/hold/stop/ping) + amber #f5a623 accent used sparingly for CTAs and key state
- **Typography triad:**
  - `Fraunces` (variable serif) for display/narrative
  - `Outfit` sans for body
  - `JetBrains Mono` for data, timestamps, codes
- **Texture:** faint grid-line background with amber vignette at top
- **Motion:** pulse-ping dots for live signals, slide-up on new log entries, shimmer for loading
- **Cue language:** monospace UPPERCASE with widest letter-spacing (0.2em) for eyebrow labels — the Bloomberg-terminal signal

### Files shipped (22 new in Session 3)

```
Config (5)
  package.json              next 15, react 19 rc, supabase-ssr, tailwind 3.4
  next.config.js            Supabase image remote pattern, CORS headers
  tsconfig.json             strict, bundler moduleResolution, path aliases
  tailwind.config.ts        Vetair palette + fonts + animations
  postcss.config.js

App shell (3)
  app/layout.tsx            root layout, meta, dark default
  app/globals.css           fonts, tokens, panel/scrollbar utilities
  app/page.tsx              landing: hero + ControlPanel + recent cases + architecture blurb

Case view (1)
  app/cases/[id]/page.tsx   server component: loads case, owner, pet, logs, msgs, rounds,
                            rules, evaluations — passes to LiveCaseView client component

API routes (2)
  app/api/demo/stream/route.ts     edge runtime: launches Supabase demo-stream via stream.tee(),
                                   extracts case_id, drains remainder in background
  app/api/cases/route.ts           nodejs: creates blank real-case-mode case

Core lib (3)
  lib/supabase.ts           browserSupabase(), serverSupabase(), logo URL exports
  lib/utils.ts              cn(), formatters, AGENT_META registry (colors + short codes)
  types/database.ts         Owner, Pet, Case, CommsMessage, AgentLog, ConsensusRound, etc.

UI primitives (1)
  components/ui/primitives.tsx     Panel, Pill (6 tones), Button (3 variants), Divider

Demo components (8)
  Header.tsx                logo + live UTC clock + system-live pill
  ControlPanel.tsx          mode toggle + script picker + speed + launch button
  LiveCaseView.tsx          ★ stitches everything; Supabase realtime subscriptions
  AgentChatter.tsx          live agent log stream, color-bordered entries
  ThreeVoicePanel.tsx       ★★ killer visual: 3 voice cards + consensus banner
  ConsensusTimeline.tsx     vertical rail timeline of plan steps
  WhatsAppPanel.tsx         iMessage-style chat, amber/ink bubbles
  CaseStateMachine.tsx      horizontal state pill progression
  RequirementMatrix.tsx     9-rule grid with citation links
```

### Architecture decision made this session

**Realtime > SSE passthrough.**
Originally planned to have the client tail the SSE stream directly. Problem: the Supabase demo-stream edge function runs once per invocation — if client re-invoked, it would re-run the script and duplicate writes. Fixed with `stream.tee()` in the API route: launch extracts `case_id` from first event, drains remainder in the background (via `waitUntil` on Vercel edge), and the client **only uses Supabase realtime subscriptions** on the case page. Cleaner, more robust, survives reconnects.

## What works end-to-end

1. User opens `/`, sees hero + ControlPanel
2. Clicks "Run demo" with dramatized mode + james_luna script
3. `/api/demo/stream` POSTs to Supabase demo-stream edge function
4. Supabase seeds owner + pet + case, begins streaming 20 steps
5. API route captures case_id from start event, returns JSON
6. Client redirects to `/cases/[id]?script=...`
7. Server component loads all case data
8. Client component subscribes to realtime channel
9. As edge function writes to `comms_messages`, `agent_logs`, `consensus_rounds`, `requirement_evaluations`, UI updates live
10. Three-voice panel animates verdicts converging
11. WhatsApp panel streams messages
12. Case state pill progresses
13. Final step closes case, all panels show consensus

## Required env vars for Vercel

```
NEXT_PUBLIC_SUPABASE_URL=https://yydnaisrgwiuuiespagi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase dashboard>
SUPABASE_SERVICE_ROLE_KEY=<server-only, for /api/cases>
```

And on Supabase side (set via dashboard → Settings → Functions):
```
ANTHROPIC_API_KEY=<for real-case-mode compliance-evaluate>
```

## → Session 4 preview

WhatsApp Business API sandbox wiring. The UI already has a WhatsApp panel as visual fallback — Session 4 makes it real:

- Meta for Developers onboarding (sandbox phone number)
- `/api/webhooks/whatsapp` route (GET verify + POST receive)
- Media message handling (document uploads trigger Claude vision extraction)
- Outbound via Graph API
- 5-test-number sandbox limit

## → Session 5 preview

End-to-end polish:
- Demo rehearsal recording
- Any rough edges identified during rehearsal
- Optional custom domain
- Optional password protection of staging deploy
