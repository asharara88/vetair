import { NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * Two-phase demo-stream handler:
 *
 * Phase 1 — launch: client calls without `tail_only` and without `case_id`.
 *   Route opens the SSE connection to Supabase edge function, reads just
 *   the `start` event to capture the seeded case_id, then keeps the
 *   upstream reader alive in the background so the script continues to
 *   write to Supabase. Client receives { case_id } JSON and redirects to
 *   the case view; Supabase realtime delivers all subsequent events.
 *
 * Phase 2 — tail: client in the case view calls with `tail_only: true` and
 *   `case_id` already known. Route passes the SSE through so the client
 *   can render a step-progress counter. The edge function, given the same
 *   case_id, does NOT re-seed a new owner/pet.
 *
 * (Realtime subscriptions handle persistence; SSE just drives the
 * progress counter. Even if SSE drops, the UI remains correct.)
 */
export async function POST(req: Request) {
  const body = await req.json();
  const tailOnly = body.tail_only === true;

  const upstream = await fetch(`${SUPABASE_URL}/functions/v1/demo-stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      script_name: body.script_name,
      case_id: body.case_id,
      speed: body.speed ?? 1,
      target_whatsapp_number: body.target_whatsapp_number,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: "upstream failed", status: upstream.status },
      { status: 502 },
    );
  }

  if (tailOnly) {
    // Pass the SSE through to the browser for progress tracking.
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Launch mode: split the stream. One branch reads until `start`, returns case_id.
  // The other branch drains the remainder in the background so the edge function
  // can keep running and writing to Supabase.
  const [a, b] = upstream.body.tee();
  const reader = a.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let caseId: string | undefined;

  while (!caseId) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    for (const chunk of chunks) {
      if (!chunk.startsWith("data:")) continue;
      try {
        const evt = JSON.parse(chunk.slice(5).trim());
        if (evt.type === "start" && evt.case_id) {
          caseId = evt.case_id;
          break;
        }
      } catch {}
    }
  }

  try { await reader.cancel(); } catch {}

  // Keep the background branch draining without blocking the response. This
  // holds the upstream connection open long enough for the edge function to
  // finish all its DB writes. On Vercel edge, waitUntil hangs the lambda;
  // when absent we just fire-and-forget — Supabase realtime is the source
  // of truth for the UI either way, so a dropped tail is non-fatal.
  const drain = async () => {
    const r = b.getReader();
    try {
      while (true) {
        const { done } = await r.read();
        if (done) break;
      }
    } catch {
      // upstream closed; nothing to do
    }
  };
  type WaitUntilCapable = { waitUntil(p: Promise<unknown>): void };
  const maybeWaitUntil = (req as unknown as Partial<WaitUntilCapable>).waitUntil;
  if (typeof maybeWaitUntil === "function") {
    maybeWaitUntil.call(req, drain());
  } else {
    void drain();
  }

  return NextResponse.json({ case_id: caseId ?? null });
}
