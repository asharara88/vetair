// Thin Anthropic Messages API wrapper used by every LLM-backed agent.
// Server-only. Expects ANTHROPIC_API_KEY in env.
//
// Why this shape rather than the official SDK:
// - we already use raw fetch in document-extract.ts; staying on fetch keeps
//   the bundle uniform across Node + edge runtimes
// - we want a single chokepoint for token accounting + cost calculation
//   (per-model rates) so every agent's agent_logs row is honest

import "server-only";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

// Per-million-token pricing in USD. Updated to current Anthropic public rates.
// If a model id isn't listed here we still proceed but log cost as 0 and emit a console warning.
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-7":      { input: 15, output: 75 },
  "claude-opus-4-20250514":   { input: 15, output: 75 },
  "claude-sonnet-4-6":    { input: 3,  output: 15 },
  "claude-sonnet-4-20250514": { input: 3,  output: 15 },
  "claude-haiku-4-5":     { input: 1,  output: 5 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

export interface ClaudeContentText { type: "text"; text: string }
export interface ClaudeContentImage { type: "image"; source: { type: "base64"; media_type: string; data: string } }
export interface ClaudeContentDocument { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } }
export type ClaudeContent = ClaudeContentText | ClaudeContentImage | ClaudeContentDocument;

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string | ClaudeContent[];
}

export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ClaudeRequest {
  model: string;
  system?: string;
  messages: ClaudeMessage[];
  max_tokens: number;
  temperature?: number;
  tools?: ClaudeTool[];
  tool_choice?: { type: "auto" | "any" } | { type: "tool"; name: string };
}

export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface ClaudeToolUse {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ClaudeTextBlock { type: "text"; text: string }
export type ClaudeOutputBlock = ClaudeTextBlock | ClaudeToolUse;

export interface ClaudeResponse {
  id: string;
  model: string;
  role: "assistant";
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | string;
  content: ClaudeOutputBlock[];
  usage: ClaudeUsage;
}

export interface CallResult {
  ok: true;
  response: ClaudeResponse;
  text: string;             // concatenated text blocks (may be empty if tool_use only)
  tool_use?: ClaudeToolUse; // first tool_use block, if any
  latency_ms: number;
  cost_usd: number;
}

export interface CallError {
  ok: false;
  status: number;
  error: string;
  latency_ms: number;
}

function priceFor(model: string, usage: ClaudeUsage): number {
  const p = PRICING[model];
  if (!p) {
    console.warn(`[anthropic] unknown model "${model}" — cost recorded as $0`);
    return 0;
  }
  return (usage.input_tokens * p.input + usage.output_tokens * p.output) / 1_000_000;
}

export async function callClaude(req: ClaudeRequest): Promise<CallResult | CallError> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 500, error: "ANTHROPIC_API_KEY not set", latency_ms: 0 };
  }

  const started = Date.now();
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": API_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(req),
  });
  const latency_ms = Date.now() - started;

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      error: `Anthropic ${res.status}: ${errText.slice(0, 300)}`,
      latency_ms,
    };
  }

  const response = (await res.json()) as ClaudeResponse;
  const text = response.content
    .filter((b): b is ClaudeTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const tool_use = response.content.find((b): b is ClaudeToolUse => b.type === "tool_use");
  const cost_usd = priceFor(response.model, response.usage);

  return { ok: true, response, text, tool_use, latency_ms, cost_usd };
}

// Extract a JSON object from a text response. The model is instructed elsewhere
// to return JSON only, but we still strip code fences defensively.
export function parseJson<T>(text: string): T | null {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Last-ditch: pluck the first {...} block.
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]) as T; } catch { return null; }
  }
}

// Crude token estimator (≈4 chars per token). Used only to log over-budget warnings;
// real accounting comes from the API response's usage block.
export function approximateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
