# Session 6 — Complete

**Cleanup + roster completion. Shared tool defs extracted; the five operational agents named in AGENT.md §3 are now in `lib/agents/` with prompts and registry metadata.**

## Refined

### Shared tool definitions — `lib/agents/shared-tools.ts`

Three tool shapes were duplicated across `intake`, `compliance`, `comms`, `orchestrator` and `specialist`:

- `request_document` (kind enum drifted across files — `compliance` and `comms` listed six kinds; `specialist` added `confirm_destination`)
- `ask_user_for_input` (identical shape, copy-pasted into four files)
- `acknowledge_and_wait` (identical shape, copy-pasted into two files)

Now exported once from `shared-tools.ts`. `DOCUMENT_KINDS` is the canonical list — the specialist appends `confirm_destination` to it instead of redefining the whole enum. Every agent file that previously held an inline copy now imports the shared shape.

Net effect: enum drift becomes impossible without editing the shared module, and the agent files shed ~40 lines of boilerplate without losing any behavior.

## Built

Five new agent definitions land in `lib/agents/`, each with a prompt at `lib/prompts/<name>.md` and a registry-meta entry (`AgentType` + order + tone + blurb) plus display metadata in `lib/utils.ts`:

| Agent | Model | Terminal tools |
|---|---|---|
| **vet_network** | Haiku 4.5 | propose_appointments · confirm_booking · ask_user_for_input · no_vet_available |
| **airline_crate** | Sonnet 4.6 | propose_routing · confirm_booking · ask_user_for_input · no_routing_available |
| **endorsement** | Sonnet 4.6 | propose_endorsement_appointment · submit_to_authority · track_courier · ask_user_for_input · window_infeasible |
| **audit** | Haiku 4.5 | dispatch_exception · notify_operator · mark_benign |
| **exception_handler** | Sonnet 4.6 | emit_remediation_plan · reroute_corridor · request_orchestrator_cycle · escalate_to_human · fail_exception |

`audit` and `exception_handler` are the registry-side definitions for the existing `status-watchdog-agent` and `exception-handler-agent` edge functions — same terminal-tool contract, now discoverable through `lib/agents/index.ts` and the architecture page.

The static roster is now 12 agents (was 7):

```
orchestrator · intake · document · compliance · auditor
vet_network · airline_crate · endorsement · comms
audit · exception_handler · synthesizer
```

Plus the `specialist` template, unchanged but cleaner — its `request_document` kind enum is now derived from `DOCUMENT_KINDS` so additions in one place propagate automatically.

## Verified

- `npx tsc --noEmit` — 0 errors
- `npx next build` — clean build, all 11 routes generate
- `STATIC_AGENTS` enumerates all 12 agents and every `validateAgent(...)` passes (terminal_tools ⊆ tools)

## Still pending (unchanged from Session 5)

The new agent definitions are registry-side only — the edge-function workers for `vet_network`, `airline_crate`, and `endorsement` are not yet implemented. The static definitions exist so the architecture page, orchestrator dispatch table, and AgentRegistry panel can display them, and so future workers have a typed contract to implement against.

For the demo, the dramatized `demo-stream` continues to emit these agent names directly into `agent_logs` (see `lib/utils.ts` AGENT_META legacy section).

## Next session candidates

- **Session 7a — Live `vet_network` worker**: wire a Haiku loop that reads `requirements_missing` and emits `propose_appointments` rows. Edge function under `supabase/functions/vet-network-agent/`.
- **Session 7b — DB seed for the new registry entries**: insert `agent_registry` rows for the five new agents so the architecture page renders them server-side.
- **Session 7c — Consensus timeline loop**: the agents now have matching `propose_*` terminals; implement the orchestrator-side consensus check (`AGENT.md` §2.2).
