# Vetair

> End-to-end autonomous pet relocation — a polyphonic multi-agent system.

Vetair moves pets across borders without human operators. A case opens, compliance is evaluated by three independent voices reaching consensus, specialist agents negotiate a feasible timeline, the full itinerary is delivered to the owner on WhatsApp, and the case closes. Zero human touches.

**Status:** V1 in active build — UAE ↔ UK corridor, investor/partner pitch target.

---

## What makes Vetair different

Most "multi-agent" systems are linear pipelines with nice branding. Vetair is genuinely **polyphonic** — agents reason against each other:

1. **Three-voice compliance spine.** Every compliance decision goes through three independent voices:
   - **Claude Sonnet 4** — primary reasoning agent
   - **Deterministic TypeScript engine** — rule-based, no LLM, evaluates against ground-truth country_rules JSON
   - **Claude Opus 4.7 auditor** — re-asked with reversed framing ("find reasons this case CANNOT fly")

   Disagreement triggers escalation. Three-way consensus proceeds.

2. **Consensus timeline loop.** Vet Network, Airline/Crate, and Endorsement agents negotiate a consistent timeline through a consensus round. No human scheduler.

3. **Watchdog audit pattern.** An Audit Agent runs async, verifying citation coverage (must be 100%), cross-checking deterministic vs LLM verdicts, flagging SLA breach risk.

4. **Never hallucinated.** Every customer-facing claim cites a specific requirement code (UK-DOG-003-WAIT-21DAYS, AE-DOG-001-IMPORT-PERMIT) from the ground-truth rule graph. No invented regulations.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 App Router on Vercel |
| Database / Auth / Realtime / Storage | Supabase (project: `yydnaisrgwiuuiespagi`) |
| Orchestration | TypeScript code, no n8n |
| Agent runtime | Anthropic Claude API (Sonnet 4 / Haiku 4.5 / Opus 4.7) |
| Document OCR | Claude Sonnet 4 native vision (no Textract layer) |
| Styling | Tailwind + shadcn/ui |
| Messaging | WhatsApp Business API (sandbox for V1) |

---

## Corridors supported

**V1 (live):**
- 🇦🇪 UAE → 🇬🇧 UK (dog, cat, ferret)
- 🇬🇧 UK → 🇦🇪 UAE (dog, cat)

**V2 roadmap:** EU (via NL), US, AU, Singapore, Hong Kong, Canada, Japan, NZ.

Corridor selection filter: origin AND destination must be Tier-1 digitised countries (digital permit systems, API-queryable rules, electronic health certificates). Paper-based jurisdictions require human operators and are excluded from autonomous flows.

---

## Repo structure

```
vetair/
├── README.md                     This file
├── AGENT.md                      Architecture + agent roster + conventions (read before coding)
├── LICENSE
├── .gitignore
├── package.json
├── next.config.js
├── tsconfig.json
├── tailwind.config.ts
├── vercel.json
├── .env.example
│
├── app/                          Next.js 15 App Router
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx                  Landing / demo control panel
│   ├── cases/[id]/page.tsx       Live case view
│   └── api/
│       ├── cases/route.ts
│       ├── demo/stream/route.ts  SSE: dramatized demo runner
│       └── compliance/{evaluate,audit}/route.ts
│
├── lib/
│   ├── supabase.ts
│   ├── compliance/
│   │   ├── engine.ts             Deterministic TS compliance engine
│   │   ├── evaluators.ts         evalMicrochip, evalRabiesVaccine, ...
│   │   └── types.ts
│   ├── agents/                   One file per agent
│   └── prompts/                  Versioned agent prompts (.md)
│
├── components/
│   ├── ui/                       shadcn primitives
│   └── demo/                     ControlPanel, AgentChatter, ThreeVoicePanel,
│                                 ConsensusTimeline, WhatsAppPanel, ...
│
└── types/database.ts             Generated from Supabase
```

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://yydnaisrgwiuuiespagi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase settings>
SUPABASE_SERVICE_ROLE_KEY=<from supabase settings — server only>
ANTHROPIC_API_KEY=<anthropic console>
WHATSAPP_PHONE_NUMBER_ID=<meta for developers>
WHATSAPP_ACCESS_TOKEN=<meta for developers>
WHATSAPP_VERIFY_TOKEN=<pick any string for webhook verification>
```

---

## Brand assets

Logos live in the Supabase Storage bucket `vetair logo` (public):

- Light theme: `https://yydnaisrgwiuuiespagi.supabase.co/storage/v1/object/public/vetair%20logo/VETAIR/light%20theme%20logo.png`
- Dark theme: `https://yydnaisrgwiuuiespagi.supabase.co/storage/v1/object/public/vetair%20logo/VETAIR/dark%20theme%20logo.png`

**TODO:** rename bucket to `vetair-logos` (no space) and flatten folder structure.

---

## Database

Supabase project `yydnaisrgwiuuiespagi` in org `xyqjtalpacvrlfvubnif` (Mi Casa Real Estate org).

**11 tables:**
- `owners`, `pets`, `cases`, `documents` — case model
- `country_rules`, `requirement_evaluations` — compliance ground truth + per-case verdicts
- `task_queue`, `consensus_rounds`, `agent_logs` — polyphonic coordination
- `comms_messages` — all WhatsApp/email/SMS
- `demo_scripts` — pre-seeded dramatized cases

**37 country_rules seeded** across 5 corridor+species combinations.

**2 demo scripts seeded:** `sarah_max_uae_uk_v1` (blocked-then-resolved) and `james_luna_uae_uk_happy_path_v1` (clean first-pass).

See `AGENT.md` for full schema + conventions.

---

## Demo modes

The UI has a toggle:

- **Dramatized mode** (default) — pre-seeded case streams as if live. Safe for stage, never fails. Used for investor pitch.
- **Real-case-mode** — fresh case, live Claude generation, real document upload, real compliance reasoning. Slower, variable, genuinely autonomous.

Both modes write to the same tables — the UI renders identically. Audience cannot tell them apart without the toggle.

---

## Contributing

Primary author: Ahmed Sharara ([@asharara88](https://github.com/asharara88)). Built in collaboration with Claude (Anthropic). Not accepting external contributions during V1 pitch phase.

---

## License

See `LICENSE`.
