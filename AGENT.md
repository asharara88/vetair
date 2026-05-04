# AGENT.md

> **Read this before writing any code for Vetair.**
> This is the architectural source of truth. The README is marketing; this is instruction.

---

## 1. North star

Vetair is a pet relocation platform that runs **end-to-end autonomously**. The litmus test for every design decision:

> *"Would this force a human to intervene in a clean case?"*

If yes, redesign it. The demo target is: message in → case closed, zero human touchpoints.

---

## 2. Polyphonic architecture

"Polyphonic" is not marketing. It means **agents reason against each other**, not just run in parallel. Three patterns:

### 2.1 Three-voice compliance spine

Every compliance decision is voted on by three independent voices:

| Voice | Model | Role |
|---|---|---|
| **Primary** | Claude Sonnet 4 | Reasons over case data + rule graph, returns verdict with citations |
| **Deterministic** | Pure TypeScript | Evaluates rules algorithmically — no LLM, no ambiguity |
| **Auditor** | Claude Opus 4.7 | Re-asked with **reversed framing** — "find ANY reason this case CANNOT fly" |

**Resolution logic** (in `lib/compliance/consensus.ts`):
- All 3 agree → verdict locked, case proceeds
- 2 agree, 1 dissents → **dissent is logged, case proceeds with warning**
- 2+ disagree → escalate to human (break-glass — should be rare)

The deterministic voice is the tiebreaker of last resort. It never hallucinates.

### 2.2 Consensus timeline loop

When a case is approved, Vet Network Agent, Airline/Crate Agent, and Endorsement Agent each **propose** dates. Orchestrator runs a consensus round that checks:

1. Endorsement window (7–10 days pre-flight) contains the endorsement appointment
2. Vet appointment precedes MOCCAE submission
3. Flight date is on or after `earliest_legal_departure`
4. All dates fall within owner's target window (±14 days)

If no feasible plan exists, loop proposes the next feasible target date back to the owner.

### 2.3 Watchdog audit pattern

Audit Agent runs **async**, monitoring every other agent's output. Flags:
- Citation coverage <100% (every customer-facing claim must cite a `requirement_code`)
- Deterministic vs LLM disagreement
- SLA breach risk
- Document extraction confidence <0.95

Posts findings back to Orchestrator, which can pause a case mid-flow.

---

## 3. Agent roster (V1)

9 agents total. Each has a dedicated file in `lib/agents/`.

| # | Agent | Model | File | Responsibility |
|---|---|---|---|---|
| 0 | **Orchestrator** | Sonnet 4 | `orchestrator.ts` | Case state machine, task dispatch, consensus mediation |
| 1 | **Intake** | Haiku 4.5 | `intake.ts` | Conversational intake via WhatsApp, captures pet + intent, one question per turn |
| 2 | **Document** | Sonnet 4 (vision) | `document.ts` | Reads uploaded docs natively (no OCR layer), extracts structured fields with JSON schema |
| 3 | **Compliance** | Sonnet 4 | `compliance.ts` | Primary voice in the 3-voice spine |
| 4 | **Compliance Auditor** | Opus 4.7 | `compliance_auditor.ts` | Adversarial voice in the 3-voice spine |
| 5 | **Vet Network** | Haiku 4.5 | `vet_network.ts` | Matches owner to approved vet; books microchip/vaccine/titer/endorsement |
| 6 | **Airline & Crate** | Sonnet 4 | `airline_crate.ts` | IATA LAR, CR-82 sizing, route selection, temperature embargo |
| 7 | **Endorsement** | Sonnet 4 | `endorsement.ts` | 10-day window timing, MOCCAE/APHA submission, courier tracking |
| 8 | **Comms** | Haiku 4.5 | `comms.ts` | WhatsApp outbound, emotional awareness, citation enforcement |
| 9 | **Audit** | Haiku 4.5 | `audit.ts` | Read-only watchdog (see §2.3) |

Plus a **deterministic TS engine** (not an agent, a set of functions) in `lib/compliance/evaluators.ts`.

---

## 4. Data model

Supabase project: **`yydnaisrgwiuuiespagi`** (in Mi Casa Real Estate org).

### 4.1 Case model

- **owners** — pet owner contact, WhatsApp, locale, residence + destination country
- **pets** — species (dog/cat/ferret), breed, DOB, weight_kg, microchip_id, microchip_implant_date, photo_url
- **cases** — central entity. `case_number`, corridor, target_date, earliest_legal_departure, **state** (`draft → intake → assessment → blocked | approved → documentation → vet_procedures → booking → transit → arrived → closed`), service_tier, quote_amount_usd, **demo_mode**
- **documents** — uploaded files, `extracted_fields` JSONB, `extraction_confidence`, `verified`

### 4.2 Compliance ground truth

- **country_rules** — the authoritative rule graph. 37 rules seeded across 5 corridor+species combos. Each has:
  - `requirement_code` (e.g. `UK-DOG-003-WAIT-21DAYS`) — the canonical handle for citations
  - `requirement_type` — microchip / vaccine / titer / endorsement / permit / health_cert / breed_restriction / age_restriction / carrier_rule
  - `evidence_schema` (JSONB) — what fields satisfy this
  - `time_constraints` (JSONB) — windows, waits, validity
  - `evaluator_fn_name` — name of the TS function in `lib/compliance/evaluators.ts`
  - `authoritative_source` + `source_url` — for citations
  - `priority` — 100 = hard blocker, 10 = informational

- **requirement_evaluations** — per-case verdicts. `status` (satisfied/pending/blocked/not_applicable), `evaluator` (which voice), `confidence`, `notes`, `earliest_legal_date`, `blocking_reason`

### 4.3 Polyphonic coordination

- **task_queue** — inter-agent dispatch. source_agent → target_agent, task_type, priority, payload, status
- **consensus_rounds** — the polyphonic heart. `topic` (e.g. `compliance_verdict`, `timeline_feasibility`), `participants[]`, `votes[]`, `resolution`, `final_verdict`
- **agent_logs** — every agent call. model, tokens, cost_usd, latency_ms, decision_summary, confidence, citations[]

### 4.4 Customer comms

- **comms_messages** — every WhatsApp/email/SMS. direction, channel, thread_id, whatsapp_message_id, media_urls[], status

### 4.5 Demo infrastructure

- **demo_scripts** — pre-seeded dramatized timelines as JSONB arrays. Each step: `step_num`, `agent`, `delay_ms`, `output`. Dramatized mode reads from here; real-case-mode ignores it.

---

## 5. Rules engine conventions

### 5.1 Never invent regulations

The `country_rules` table is the **only** source of truth for compliance facts. If a rule isn't there, the system doesn't know about it. Compliance Agent's system prompt explicitly forbids inventing requirement codes — it can only return codes that exist in the queried rule set.

### 5.2 Every customer-facing claim is cited

When Comms Agent says *"Max needs 21 days after his rabies vaccine"*, the underlying event log must include the citation `UK-DOG-003-WAIT-21DAYS` with `source_url`. Audit Agent enforces 100% citation coverage.

### 5.3 Deterministic wins on disagreement (on facts)

If Sonnet Compliance says "blocked" and Deterministic Engine says "approved" on a **factual** matter (e.g. date math), deterministic wins. If they disagree on a **judgment** matter (e.g. whether a document is legible), escalate.

### 5.4 Adding new corridors

1. Add rows to `country_rules` with `requirement_code` scheme: `{destCountryISO}-{SPECIES3}-{NUM}-{SLUG}`
2. Implement any new `evaluator_fn_name` referenced in the rules
3. Add the corridor to the UI country picker
4. Write a dramatized demo script for the new corridor

No agent code changes required.

---

## 6. Prompt conventions

Agent prompts live in `lib/prompts/*.md`. Versioned in git.

### 6.1 Structure every agent prompt follows

```markdown
# Role
One sentence identity.

# Context injection
{{case_id}}, {{pet_profile}}, {{corridor}}, {{rules}}, etc.

# Tools available
tool_1(args) -> returns
tool_2(args) -> returns

# Rules
- Numbered. Absolute. Non-negotiable.
- Hallucination controls explicit.

# Output format
JSON schema or structured tool calls only. No free-text output for structured data.
```

### 6.2 Hallucination controls

Every prompt includes the phrase:

> *"Only make factual claims about country rules if the requirement_code appears verbatim in the rules context. Otherwise say: 'I'll verify and get back to you.'"*

### 6.3 Tool use enforced

Structured data is **never** returned as JSON in response text. Always via tool calls with JSON schemas. If a prompt returns `{"foo": "bar"}` in prose, it's a bug.

### 6.4 Context budget

Hard cap per agent call: **40k input tokens**. If context exceeds, summarize oldest half via Haiku before proceeding.

---

## 7. Demo modes

UI has a toggle:

### 7.1 Dramatized

- Pre-seeded case state advances on a scripted timeline
- Each agent's "output" is pulled from `demo_scripts.steps` JSONB
- Streamed with authentic delays (`delay_ms`)
- Writes to `agent_logs`, `consensus_rounds`, `comms_messages` as if real
- **Never fails.** Safe for stage.

### 7.2 Real-case-mode

- Fresh case, live Claude generation
- Real document upload → real Claude vision extraction
- Real deterministic engine evaluation
- Real Opus adversarial re-check
- Slower, variable output, occasionally messy
- **This is the system actually working.**

Both modes produce identical UI. The toggle is a single switch in Demo Control Panel.

---

## 8. State machine

Cases flow through these states (enforced at DB level via CHECK constraint):

```
draft → intake → assessment → blocked | approved
                                       │
                                       ▼
                      documentation → vet_procedures → booking → transit → arrived → closed
```

Terminal states: `closed`, `cancelled`. State transitions only via Orchestrator — never directly.

---

## 9. WhatsApp integration

Using Meta WhatsApp Business API sandbox for V1.

**Required env:**
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_VERIFY_TOKEN`

**Webhook path:** `POST /api/webhooks/whatsapp` (verify: `GET /api/webhooks/whatsapp`)

**Sandbox limits:**
- 5 test phone numbers can receive messages
- Outbound to new numbers requires approved templates
- 24-hour session window for free-form replies after an inbound message

**Fallback:** if Meta onboarding delays a live demo, `components/demo/WhatsAppPanel.tsx` renders a visually identical panel inside the UI. Audience cannot tell.

---

## 10. Security & secrets

- **Never commit `.env.local`** — only `.env.example` (no real values)
- Service role key is server-only (API routes, never shipped to browser)
- Anon key is fine for browser use (RLS enforces authorization)
- WhatsApp access token is long-lived — rotate before production
- Anthropic API key is server-only

Supabase RLS: permissive `all_access` policies on all tables during V1 demo. **Tighten before onboarding real users** — every table needs per-owner row access.

---

## 11. Conventions for future Claude sessions

When continuing work on Vetair:

1. **Read this file first.** Don't guess the architecture — it's here.
2. **Ground truth is Supabase** (`yydnaisrgwiuuiespagi`). Run `SELECT * FROM country_rules` if you're unsure what rules exist. Don't invent rules in prompts.
3. **Deterministic code wins over LLM on facts.** If you're tempted to put date math in a prompt, put it in `evaluators.ts` instead.
4. **Polyphonic is a design principle, not a label.** Every new decision type should ask: "can three voices weigh in on this?" If yes, wire it that way.
5. **Citation coverage is 100%.** Every customer-facing statement must trace back to a `requirement_code`. Audit Agent fails the build if not.
6. **Demo mode is first-class, not an afterthought.** Every code path must work in both dramatized and real modes. Test both.
7. **One file per agent.** No megafile.
8. **Prompts are versioned in git** at `lib/prompts/*.md`. When you change a prompt, bump the version in `agent_logs.model` suffix.

---

## 12. Session log (build progress)

- **Session 1** (complete): Supabase project, 11-table schema, 37 country_rules across 5 corridor+species combos, 2 demo scripts (Sarah+Max blocked-then-resolved, James+Luna happy-path)
- **Session 2** (complete): Deterministic TS compliance engine + Edge Function (`compliance-evaluate`, `compliance-audit`, `demo-stream`)
- **Session 3** (complete): Next.js UI scaffold — demo control panel, agent chatter stream, three-voice panel, WhatsApp panel
- **Session 4** (complete): WhatsApp Business API sandbox wiring (verify webhook + outbound `whatsapp-send` edge function)
- **Session 5** (complete): `demo-stream` → `whatsapp-send` wiring; `target_whatsapp_number` propagated through the proxy and ControlPanel UI
- **Session 7** (complete): Static MAS agent registry — 7 agent definition files (orchestrator, intake, document, compliance, auditor, comms, synthesizer) + parameterized specialist template
- **Session 8** (complete): Refactor + agent build-out — extracted shared tool helpers (`lib/agents/shared-tools.ts`); added the four remaining V1 agents (`vet_network`, `airline_crate`, `endorsement`, `audit`) with versioned prompts; registry-meta + AGENT_META + TERMINAL_TONE updated to render them in the UI

---

*Last updated: Session 8 close.*
