# Session 3 — Plan (v2, revised)

**Goal:** Ship a pitch-grade demo cockpit. By end of session: `vetair.vercel.app` loads, looks deliberate, and plays two cinematic demo scripts that leave the room convinced this system is genuinely autonomous.

This is not a CRUD UI. It's a stagecraft instrument.

---

## 1. Framing — what this UI is for

Three distinct audiences, one screen:

| Audience | What they need to feel |
|---|---|
| **Investor** | "This is real infrastructure, not a prototype. The unit economics are obvious." |
| **Developer partner** | "The architecture is considered. The polyphonic thing is real." |
| **Operator buyer** | "This replaces a headcount. I can run my book on this." |

The UI has to serve all three in a single run. That means:
- The **three-voice moment** is inarguable (for the dev)
- The **cost / time counters** are always visible (for the investor)
- The **"and the owner just gets a WhatsApp message"** punchline is obvious (for the operator)

---

## 2. The demo narrative — what the UI is conducting

A demo has a *structure*, not just data. Both seeded scripts follow this 5-act arc:

### Act 1 — Cold open (steps 1–7)
Stage is dim. Just the WhatsApp panel lit. Owner types. Intake agent replies. Feels like a normal chat support flow. Audience thinks *"ok, a chatbot."*

### Act 2 — The reveal (step 8)
Document uploads. Document Agent card **lights up** in the center. Confidence badge pops (0.96 / 0.97). Extracted JSON unfolds beside the uploaded image. First *"oh."*

### Act 3 — The three voices (steps 9–12) — **THE MONEY SHOT**
Center stage. Three tall cards slide in from offstage: **Sonnet 4 Primary**, **Deterministic Engine**, **Opus 4.7 Auditor**. Each shows its verdict forming in real time (token-by-token streaming for the LLM voices, instant snap for deterministic). When all three agree, a **consensus pill** fires with an audible click/haptic pulse. When they *disagree* (Sarah+Max case), the dissenting card pulses red and the resolution animation runs.

### Act 4 — The orchestra (steps 13–18)
Three smaller specialist cards come in (Vet, Airline, Endorsement) and propose dates. A **timeline** populates left-to-right. Any date conflict shows a red connecting line that resolves when the consensus round closes.

### Act 5 — The punchline (steps 19–20)
WhatsApp panel lights up again. Full itinerary delivered. **"human_touchpoints: 0"** counter flashes. Case state pill goes green. Elapsed-time and cost readouts lock. Audience applauds. (Hopefully.)

**The UI's job is to conduct this arc.** Animations, pacing, spotlighting — not decorating data.

---

## 3. Layout — the cockpit

**Not three equal columns.** A deliberate hierarchy.

```
+-------------------------------------------------------------------+
|  [Logo]  Vetair — live case view         sun/moon  1x 2x 5x 10x   |   <- Header: brand, theme toggle, speed, transport
+-------------------------------------------------------------------+
|                                                                   |
|          +-----------------------------------------+              |
|          |                                         |              |
|          |     THREE-VOICE SPINE (centerpiece)     |              |
|          |                                         |              |
|          |  Sonnet 4       Deterministic    Opus 4.7              |
|          |  +-------+      +-------+      +-------+               |
|          |  |primary|      |  det  |      |auditor|               |
|          |  |       |      |       |      |       |               |
|          |  +-------+      +-------+      +-------+               |
|          |          . . . CONSENSUS . . .          |              |
|          +-----------------------------------------+              |
|                                                                   |
|  +---------------+  +-------------------+  +------------------+   |
|  |               |  |                   |  |                  |   |
|  | Case State    |  | Consensus Timeline|  | Requirement      |   |
|  |  Machine      |  | (vet/air/endorse) |  | Matrix (9 rules) |   |
|  |               |  |                   |  |                  |   |
|  +---------------+  +-------------------+  +------------------+   |
|                                                                   |
+------------------------------------+------------------------------+
|                                    |                              |
|  WhatsApp Panel                    |  Agent Chatter (compact)     |
|  (evidence, not centerpiece)       |  (scrolling log, muted)      |
|                                    |                              |
+------------------------------------+------------------------------+
    [Footer: elapsed 00:00.0s | cost $0.0000 | tokens 0 | human_touchpoints: 0]
```

The three-voice spine occupies the **upper center ~45% of viewport**. Everything else is supporting evidence.

---

## 4. Three themes, not just dark + light

You asked for a toggle. I'll ship three, controlled by a single header pill:

| Theme | Use | Character |
|---|---|---|
| **Night** | Default, on-stage, in a dark room | Near-black `#0A0A0C` bg, high-contrast accent glow, feels like a cockpit |
| **Day** | Screenshots, deck embedding, Sunday-morning demos | Warm off-white `#FAFAF7`, reduced glow, print-ready |
| **Focus** | For dev audience, during Q&A | Monochrome, removes all color-coded status, forces attention to the data itself |

Stored in `localStorage`. Header keyboard shortcut: `T` cycles.

---

## 5. The four stagecraft primitives (new — missing from v1)

### 5.1 Persistent telemetry strip (footer)

Always visible. Four counters, monospace:

```
elapsed 00:22.4s  |  cost $0.0187  |  tokens 18,243  |  human_touchpoints: 0
```

Updates in real time as `agent_logs` rows land. The `cost` ticker visibly incrementing is the investor hook. The `0` on `human_touchpoints` staying `0` is the operator hook.

### 5.2 Citation hover-cards

Every requirement_code in the UI (in chatter feed, in voice cards, in compliance matrix) is a hoverable/tappable chip. Hover shows:

```
+------------------------------------------+
| UK-DOG-003-WAIT-21DAYS                   |
| priority 95 / hard gate                  |
| ---------------------------------------- |
| 21-day wait period from primary rabies   |
| vaccination before entry to GB           |
|                                          |
| wait_days_from_primary_vaccine: 21       |
| earliest_entry_formula:                  |
|   first_vaccine_date + 21 days           |
|                                          |
| [external] gov.uk/bring-pet-to-great...  |
+------------------------------------------+
```

Proves "never hallucinated." Any auditor in the room can click anywhere and land on gov.uk. This is the single biggest trust signal.

### 5.3 Keyboard transport controls

| Key | Action |
|---|---|
| `Space` | Pause/resume the stream |
| `R` | Reset case (destructive, confirms) |
| `1`–`9` | Jump to step N |
| `left / right` | Step back/forward |
| `T` | Cycle theme |
| `?` | Show cheat sheet overlay |
| `Esc` | Exit live view, back to control panel |

Non-negotiable for pitch. You can't demo to someone asking questions without pause. Hidden unless `?` pressed so they don't clutter the on-stage UI.

### 5.4 Post-run inspector mode

After a demo completes (or at any time via `I` key), the UI flips into **inspector mode**:

- Dimmed background behind a full-screen panel
- Tabbed: **Agents** / **Consensus** / **Rules** / **Raw DB**
- **Agents tab**: every `agent_logs` row for this case, sortable, with input/output JSON expandable
- **Consensus tab**: every `consensus_rounds` row with the full three-way vote breakdown
- **Rules tab**: all 9 rules + their evaluation by all three voices side-by-side
- **Raw DB tab**: JSON dump of case, pet, documents, requirement_evaluations — "this is what's actually in the database right now"

For the dev in the room who asks *"what did it actually just do?"*

---

## 6. The three-voice panel — deep design

This is the centerpiece. Design rules:

- **Three cards, equal width.** Never resize — all three voices have equal weight by design.
- **Color coding is persistent** (Sonnet = blue `#60A5FA`, Deterministic = green `#34D399`, Opus = violet `#A78BFA`). Three colors appear *nowhere else* in the UI. When you see those colors, you're looking at a voice.
- **Each card has three states:**
  1. *Waiting* — outlined, muted, spinner
  2. *Thinking* — gradient shimmer along the card border, token count ticks up, for LLMs: streaming text preview fades in
  3. *Decided* — verdict badge (approved green / blocked red / pending amber), confidence bar, timestamp
- **The consensus pill below** has its own three states:
  1. *Pending* — three dots, greyed
  2. *Converging* — dots start lighting up as each voice decides
  3. *Resolved* — pill fills with verdict color, shows `CONSENSUS` or `DISAGREEMENT RESOLVED BY MAJORITY`
- **If voices disagree**, the dissenting card **pulses once (subtle, 400ms)**, a connecting line appears between the disagreeing cards with the delta, and the consensus pill explicitly shows *"1 of 3 dissented: {reason}"*. We celebrate disagreement — it's proof the adversarial system works.

Implementation: pure CSS animations + a thin state machine. No heavy animation library.

---

## 7. Realtime without fragility

The v1 plan said "Supabase realtime for everything." In practice realtime drops occasional events, especially over hotel WiFi. Fallback needed.

**Hybrid strategy:**
1. **Primary path:** Subscribe to realtime channels for `agent_logs`, `comms_messages`, `consensus_rounds`, `requirement_evaluations`, `cases`
2. **Polling watchdog:** Every 2 seconds, `SELECT count(*)` from each table for this case_id. If realtime event count < DB row count for any table, **force reconcile** (full reload of that table)
3. **Manual resync button** in the header: hard refresh all panels from DB state

Result: the demo is resilient to network hiccups. Audience never sees a desynced UI.

---

## 8. Real-case-mode — not stubbed

v1 plan said "stub for Session 3, real for Session 4+." Weak. Investor asks *"ok now do one live"* and the stub breaks the story.

**Revised:** Session 3 ships real-case-mode as a **minimum viable single-turn intake**:
- Opens a drawer: "Paste/upload vaccination record, pet name, breed, target date"
- Calls `compliance-evaluate` edge function directly
- All three voices run live (because the edge function is already deployed from Session 2)
- The same cockpit renders the result

No WhatsApp wiring, no multi-turn intake (those are Session 4's job). But the three-voice moment is **real** on any new case the audience invents.

If `ANTHROPIC_API_KEY` isn't configured, the drawer shows a clear setup CTA linking to the right Supabase settings page. Dramatized mode still works.

---

## 9. Brand integration — three weighted touchpoints

Not just "put logo in header."

### 9.1 Landing hero
`/` loads with a 3-second branded overture:
- Dark hero, vetair logo crossfade from light→dark variant
- Single tagline: *"End-to-end autonomous pet relocation."*
- Single CTA: *"Watch a live case"*
- Subtext, smaller: *"Three demo scripts available. Two run end-to-end with zero human touch."*

### 9.2 Cockpit header
Logo at 32px left. Color pulled from logo image via extraction script committed to repo (not hardcoded). Theme toggle on the right.

### 9.3 Footer signature
Footer of both landing and cockpit: `Vetair V1 · Mi Casa Real Estate · vetair.ai` (or whatever domain ships). Tiny. Confident. Not apologetic.

**Logo bucket fix in this session:** the `vetair logo` bucket has a space. We'll rename it to `vetair-assets` and flatten the folder in Session 3 (5 minutes of work, prevents every future URL-encoding headache).

---

## 10. Vercel deployment strategy

**One commit, one deploy.** No 12-step micro-commits.

Branch strategy:
- `main` auto-deploys to `vetair.vercel.app` (production-equivalent for V1)
- Feature work on `session-3-ui` branch, merged to main when Session 3 complete
- Every merge = one production deploy

Env vars set at **project level**, not per-deployment:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

No secrets on Vercel — the edge functions hold those. Vercel is pure presentation layer.

Custom domain: deferred (user hasn't decided). `vetair.vercel.app` works for V1 pitch. When you decide (`vetair.ai` / `vetair.app` / `vetair.io`), 5-minute DNS add in Vercel dashboard.

---

## 11. Scope discipline — what's NOT in Session 3

Explicitly out of scope (don't let feature creep kill the session):

- Multi-turn intake conversation UI (Session 4, with real WhatsApp)
- WhatsApp Business API webhook wiring (Session 4)
- Real Document Agent vision extraction (Session 4, triggered by real uploads)
- Real Vet Network / Airline / Endorsement agents (Session 5, dramatized in V1)
- Owner-facing portal (Session 6+)
- Multi-case dashboard / admin analytics (post-V1)
- Authentication / multi-tenancy (post-V1, RLS is permissive for now)

---

## 12. Pre-session checklist

Before Session 3 kicks off:

1. [ ] README.md + AGENT.md pushed to `asharara88/vetair` GitHub
2. [ ] Session 2 edge function source committed at `supabase/functions/`
3. [ ] `ANTHROPIC_API_KEY` set on Supabase (required for real-case-mode; dramatized doesn't need it)
4. [ ] Supabase storage bucket renamed `vetair logo` → `vetair-assets` (5 min)
5. [ ] Vercel project created from `asharara88/vetair` with `NEXT_PUBLIC_SUPABASE_*` env vars set

Items 1–2 can happen now from the Session 2 deliverables. Item 3 is a Supabase dashboard click. Items 4–5 we do at start of Session 3.

---

## 13. Session 3 sequencing (revised — fewer, bigger commits)

**Commit 1 — Foundation**
- Config files (package.json, tsconfig, tailwind, next.config, postcss, vercel.json)
- `.env.example`, `.gitignore`
- `app/layout.tsx` with three-theme provider
- `app/globals.css` with full design tokens
- `lib/supabase.ts`, `lib/types.ts`, `lib/edge.ts`
- `components/brand/Logo.tsx`
- Minimal `app/page.tsx` hero
- **Deploys to Vercel. Landing loads. Nothing else.**

**Commit 2 — Control panel**
- `components/demo/ControlPanel.tsx`
- Script selector, speed controls, mode toggle
- Wired to `demo-stream` edge function
- Navigation to `/cases/[id]` on run
- Real-case-mode drawer stub (visible, functional minimum)

**Commit 3 — The three-voice centerpiece**
- `components/demo/ThreeVoicePanel.tsx` with all three card states + animations
- `components/demo/ConsensusPill.tsx`
- Realtime subscription to `consensus_rounds` and `agent_logs`
- Manual test against seeded case IDs from Session 1/2

**Commit 4 — Supporting panels**
- `components/demo/WhatsAppPanel.tsx`
- `components/demo/ConsensusTimeline.tsx`
- `components/demo/RequirementMatrix.tsx`
- `components/demo/CaseStateBadge.tsx`
- `components/demo/AgentChatter.tsx`
- All wired to realtime

**Commit 5 — Stagecraft layer**
- `components/telemetry/TelemetryFooter.tsx` (elapsed / cost / tokens / human touchpoints)
- `components/stagecraft/CitationHoverCard.tsx`
- `components/stagecraft/KeyboardTransport.tsx`
- `components/stagecraft/InspectorPanel.tsx`

**Commit 6 — Assembly**
- `app/cases/[id]/page.tsx` — full cockpit
- Realtime watchdog for fallback
- Error boundaries, empty states, loading states
- End-to-end rehearsal run of both scripts at 1x and 10x

Six commits, each one deployable. If we run out of time at commit 4, we still have a demo-able cockpit — just without the stagecraft layer.

---

## 14. Success criteria (revised — pitch-measurable)

- [ ] Cold load to landing in <1s on hotel WiFi
- [ ] James+Luna 10x run completes in <3 seconds end-to-end with no desync
- [ ] Sarah+Max 1x run hits all 5 narrative acts correctly, with the disagreement-then-consensus beat visible
- [ ] Real-case-mode works for a minimal hand-typed case
- [ ] Every requirement_code chip resolves to a citation hover-card with a gov source link
- [ ] Three themes all render correctly (Night / Day / Focus)
- [ ] Telemetry footer ticks live and `human_touchpoints` stays `0`
- [ ] Keyboard shortcuts all work
- [ ] Inspector mode opens on `I`, shows real data for current case
- [ ] On a laptop + projector, the three-voice-agreeing moment is readable from 4m away

---

## 15. Sessions beyond 3

- **Session 4:** WhatsApp Business API sandbox, real inbound webhook, multi-turn intake conversation agent, Document Agent with Claude vision
- **Session 5:** Real Vet Network / Airline-Crate / Endorsement agents as edge functions, replacing the dramatized outputs
- **Session 6:** Pitch rehearsal pass — failure mode handling, offline fallback, recorded backup video, timing drills against an actual pitch deck

---

*v2 plan. Addresses v1's CRUD-checklist framing. This version is the cockpit spec.*
