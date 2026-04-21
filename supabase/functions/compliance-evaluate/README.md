# compliance-evaluate

Three-voice compliance spine. Called from the Next.js app for real-case-mode compliance evaluation.

## Invocation

```bash
curl -X POST \
  https://yydnaisrgwiuuiespagi.supabase.co/functions/v1/compliance-evaluate \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"case_id": "<uuid>"}'
```

## Required env

- `SUPABASE_URL` (set automatically)
- `SUPABASE_SERVICE_ROLE_KEY` (set automatically)
- `ANTHROPIC_API_KEY` — set at https://supabase.com/dashboard/project/yydnaisrgwiuuiespagi/settings/functions

## Response shape

```json
{
  "success": true,
  "consensus_round_id": "<uuid>",
  "resolution": "consensus" | "disagreement" | "escalated",
  "final_verdict": {
    "verdict": "approved" | "blocked" | "pending",
    "earliest_legal_departure": "YYYY-MM-DD" | null,
    "three_voices": {
      "deterministic": { "verdict": "...", "rationale": "..." },
      "primary": { "verdict": "...", "rationale": "...", "model": "claude-sonnet-4-20250514" },
      "auditor": { "verdict": "...", "rationale": "...", "model": "claude-opus-4-20250514" }
    }
  },
  "case_state": "approved" | "blocked" | "assessment",
  "stats": {
    "rules_evaluated": 9,
    "primary_latency_ms": 2800,
    "auditor_latency_ms": 3100,
    "total_cost_usd": 0.02
  }
}
```

## Side effects

Writes to:
- `consensus_rounds` — one row with final verdict and per-voice votes
- `requirement_evaluations` — one row per rule (deterministic voice)
- `agent_logs` — three rows, one per voice, with cost + latency
- `cases.state` — updated to `approved` / `blocked` / `assessment`
- `cases.earliest_legal_departure` — set if computed
