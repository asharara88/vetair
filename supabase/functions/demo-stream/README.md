# demo-stream

Streams a dramatized demo script over SSE. Writes to the same tables as real-case-mode so the UI renders identically.

## Invocation

```bash
curl -X POST \
  https://yydnaisrgwiuuiespagi.supabase.co/functions/v1/demo-stream \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"script_name": "james_luna_uae_uk_happy_path_v1", "speed": 1}' \
  --no-buffer
```

## Parameters

- `script_name` (required): one of the rows in `demo_scripts` table. Seeded scripts:
  - `sarah_max_uae_uk_v1` — blocked-then-resolved
  - `james_luna_uae_uk_happy_path_v1` — clean first-pass
- `case_id` (optional): reuse an existing case. If omitted, a demo owner+pet+case is seeded with `demo_mode=true`.
- `speed` (optional): 1=realtime (default), 0.5=2x fast, 2=half speed

## Event stream

```
data: {"type":"start","case_id":"<uuid>","script":"...","total_steps":20}
data: {"type":"step","step":1,"agent":"intake_agent","channel":"whatsapp","direction":"inbound",...}
data: {"type":"step","step":2,...}
...
data: {"type":"complete","case_id":"<uuid>"}
```

The frontend consumes this via `EventSource` and renders each step as it arrives.

## Side effects

For each step, depending on its shape:
- WhatsApp-style step → `comms_messages` row
- Agent action step → `agent_logs` row
- Consensus step → `consensus_rounds` row
- case_closed_demo step → `cases.state` updated
