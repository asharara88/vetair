# Session 6 — Complete

**Static agent roster brought to V1 completeness. The four operations / watchdog agents that AGENT.md §3 promised but `lib/agents/` did not ship are in. Type tables, AGENT_META, and the architecture dispatch chain reflect the new roster. Typecheck + Next build clean.**

## Delivered

### 1. Four new agent definitions + prompts

Each agent gets a dedicated file under `lib/agents/` and a versioned prompt under `lib/prompts/`, matching the convention the existing seven agents use.

| Agent | File | Model | Terminal tools |
|---|---|---|---|
| `vet_network` | `lib/agents/vet_network.ts` | Haiku 4.5 | `propose_timeline`, `book_appointment`, `fail_no_match` |
| `airline_crate` | `lib/agents/airline_crate.ts` | Sonnet 4.6 | `propose_routing`, `fail_no_route` |
| `endorsement` | `lib/agents/endorsement.ts` | Sonnet 4.6 | `confirm_endorsement_complete`, `flag_courier_delay`, `request_document` |
| `audit` | `lib/agents/audit.ts` | Haiku 4.5 | `flag_finding`, `pass_audit` |

Notable design choices:

- **Vet Network** proposes a chronologically valid timeline (microchip → rabies → titer → endorsement) into a consensus round before any booking sticks. The prompt enforces the ordering constraints as absolute rules so the model can't reorder them. `book_appointment` is only invoked once the orchestrator hands back a `confirm_appointments` payload from a resolved round.
- **Airline & Crate** runs CR-82 sizing (interior L ≥ A + B/2, W ≥ 2C, H ≥ D) as a deterministic tool — the prompt enforces that any missing dimension routes through Comms rather than getting guessed. Temperature embargo has three states (`clear` / `warn` / `block`); `warn` cases proceed but cite the warning code so Comms discloses it.
- **Endorsement** enforces the 7–10 day pre-flight window as hard — early submission produces an invalid certificate. Authority routing is hard-coded (UAE → MOCCAE, UK/EU → APHA, US → USDA_APHIS). Packet completeness + per-document confidence floor (≥0.90) are required before submission.
- **Audit** is the watchdog from AGENT.md §2.3 — explicitly distinct from the Compliance Auditor. Read-only. One finding per turn so the orchestrator can sequence responses without context bloat. Severity tiers are tied to behavior: `info` is logged, `warn` annotates the case, `critical` pauses it.

### 2. Registry wiring

- `lib/agents/index.ts` — new agents added to `STATIC_AGENTS` and re-exported; `resolveStaticAgent(name)` now resolves all 11 static roster names.
- `lib/agents/registry-meta.ts` — `AgentType` union grew from 8 → 12 members. `AGENT_TYPE_ORDER`, `AGENT_TYPE_TONE`, and `AGENT_TYPE_BLURB` updated in lockstep. Operations agents (vet_network / airline_crate / endorsement) sit between auditor and comms; audit watchdog sits last with `ping` tone (alerting).
- `lib/utils.ts` — `AGENT_META` got entries for the new MAS-style names (no `_agent` suffix, distinct from the legacy demo-stream names which already had `vet_network_agent` etc.). The watchdog gets the slate-grey `#8b95a6` reserved previously for `audit_agent`.
- `app/architecture/page.tsx` — `dispatchChain` ribbon refreshed: orchestrator → intake → compliance → auditor → **Vet · Airline · Endorsement** → Comms → **Watchdog (async)**.

### 3. Code cleanup in `compliance.ts`

`SHARED_READ_TOOLS` and `ASSESSMENT_TOOL` are now typed as `AgentTool[]` / `AgentTool` directly, dropping the `type: "object" as const` ceremony that was needed to keep literal types alive through unannotated `const` declarations. The exported re-uses in `auditor.ts` and `specialist.ts` already typed their consumers as `AgentTool[]`, so the change is type-safe end-to-end.

## Verified

- `npx tsc --noEmit` — 0 errors
- `npx next build` — clean, 11 routes
- The 4 new agents pass the runtime guard in `validateAgent()` (terminal_tools ⊆ tools), enforced at module load

## Not touched (intentionally)

- `agent_registry` table in Supabase. Adding rows is a runtime registration concern, not a static-code concern; the static definitions are now available for whichever dispatcher writes the rows.
- Edge function dispatchers (`demo-stream`, `compliance-evaluate`). Those still emit the legacy `*_agent` names for the dramatized pipeline; the new MAS names live alongside, ready for the real-mode dispatcher.
- AGENT_META legacy entries (e.g. `vet_network_agent`). Kept in place so dramatized demo scripts continue to render correctly.

## Next session candidates

- **Session 7a — Real-mode dispatcher**: wire `STATIC_AGENTS_BY_NAME` into the orchestrator's `dispatch_to_agent` path so the new operations agents are actually invokable end-to-end. Today they exist as definitions only.
- **Session 7b — `consensus_rounds` for the timeline loop**: the vet_network + airline_crate + endorsement agents all `propose_*` into a consensus round, but the round-reconciliation code (which checks endorsement window contains the endorsement appointment, flight ≥ earliest_legal_departure, etc.) is not yet implemented in `lib/compliance/`. That's the natural follow-on.
- **Session 7c — Audit watchdog scheduler**: decide whether `audit` runs on a cron, on every state transition, or both. The prompt enforces one-finding-per-turn so multiple findings naturally spread across re-dispatches; the scheduling policy is still open.
