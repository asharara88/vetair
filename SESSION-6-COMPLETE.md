# Session 6 — Complete

**Registry definitions for the execution-layer agents — Status Watchdog + Exception Handler. The runtime edge functions already shipped (`a8f76a4`); this session adds the `lib/agents/` definitions + prompts that mirror them, so the static registry finally matches what the system actually runs.**

## Context

Two execution-layer agents were deployed as Supabase edge functions in an
earlier session:

- `supabase/functions/status-watchdog-agent/index.ts`
- `supabase/functions/exception-handler-agent/index.ts`

But they had no entry in `lib/agents/` — the registry that the UI and
orchestrator read to answer "what agents exist and what can they do."
`STATIC_AGENTS` listed 7 agents; the system ran 9. This session closes that gap
by adding definitions that are faithful to the deployed tool contracts (not an
idealized version of them).

## Delivered

### 1. Status Watchdog definition (`lib/agents/status_watchdog.ts`)

Mirrors the deployed edge function exactly:

- Model **Sonnet 4.6** (it reasons about urgency, not just freshness).
- Tools = terminals: `dispatch_exception`, `notify_operator`, `mark_benign`. No
  read tools — a deterministic SQL pre-filter and context enrichment happen in
  code, and the LLM is called once per stale case to pick one terminal.
- Budget: 1 turn per case decision.

The pre-filter flags a case as stale when `updated_at` is older than an
urgency-scaled threshold that tightens as `target_date` approaches (10 days far
out → 1 day when travel is imminent).

### 2. Exception Handler definition (`lib/agents/exception_handler.ts`)

Mirrors the deployed edge function exactly:

- Model **Sonnet 4.6**.
- `read_case_state` (non-terminal, called first) + five terminals:
  `emit_remediation_plan`, `reroute_corridor`, `request_orchestrator_cycle`,
  `escalate_to_human`, `fail_exception`.
- Budget: 4 turns (matches `MAX_TURNS` in the edge function).

It prefers the least-disruptive remediation and only escalates to a human when
money, legal liability, or animal welfare is at stake with no safe automated
path.

### 3. Prompts (`lib/prompts/status_watchdog.md`, `lib/prompts/exception_handler.md`)

Versioned copies of the edge functions' system prompts, reformatted into the
standard Role / Context / Tools / Rules / Output structure (AGENT.md §6).

### 4. Registry wiring

- Added `watchdog` + `exception` to the `AgentType` union in `registry-meta.ts`,
  with matching `AGENT_TYPE_ORDER`, `AGENT_TYPE_TONE`, and `AGENT_TYPE_BLURB`
  entries (the exhaustive `Record<AgentType, …>` maps force this — tsc fails if
  one is missed).
- Registered both in `STATIC_AGENTS` and the named exports in `index.ts`.
- Added display metadata (`AGENT_META`) and terminal-tool pill tones
  (`TERMINAL_TONE`) for both in `lib/utils.ts`.

## Verified

- `tsc --noEmit` — 0 errors.
- `validateAgent` invariants hold for both (terminal_tools ⊆ tools).
- Definitions cross-checked field-by-field against the deployed edge functions.

## The roster

Static definitions now exist for every agent the system runs:
orchestrator, intake, document, compliance, auditor, comms, synthesizer,
status_watchdog, exception_handler — plus the runtime-synthesized country
`specialist` the synthesizer compiles.

## Next session candidates

- **Seed `agent_registry`**: the Architecture page reads the roster from the DB,
  not from `STATIC_AGENTS`. A sync script from `STATIC_AGENTS` → `agent_registry`
  would surface watchdog + exception in the UI.
- **AGENT.md §3 honesty pass**: the roster table still lists the original vision
  (vet_network, airline_crate, endorsement, audit) rather than the agents that
  actually exist. Reconcile it with `lib/agents/`.
- **Watchdog/exception demo beat**: a scripted "case goes stale → watchdog
  flags → exception handler remediates" moment for the dramatized demo.
