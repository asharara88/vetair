// Shared HTTP helpers for Vetair edge functions.

const JSON_HEADERS = { "content-type": "application/json" } as const;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function jsonError(code: string, detail: unknown, status = 500): Response {
  return json({ error: code, detail: String(detail) }, status);
}

// Fire-and-forget POST with a hard timeout. Swallows network errors so the
// caller's loop is never blocked. Used for orchestrator-style hand-offs.
export async function fireAndForget(
  url: string,
  body: unknown,
  timeoutMs = 2000,
): Promise<void> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (_e) {
    // intentional swallow
  } finally {
    clearTimeout(timer);
  }
}
