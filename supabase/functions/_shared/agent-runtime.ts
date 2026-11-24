// Vetair · shared agent runtime (Deno edge functions)
// Common plumbing that every Claude-driven agent needs:
//   - Anthropic Messages API call with tool support
//   - agent_runs lifecycle (open / close)
//   - Model pricing and cost math
//   - Service-role Supabase client
//   - JSON response helper
//
// This module is intentionally narrow. Per-agent policy (prompt, tools,
// terminal semantics) stays in each function; only the mechanics live here.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type JsonObj = Record<string, unknown>;

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
export const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
export const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

export function supaClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Model pricing — USD per 1M tokens. Keep aligned with Anthropic's current
// public price list for the family aliases we pin.
// ──────────────────────────────────────────────────────────────────────────
interface Pricing {
  input: number;
  output: number;
}

const PRICING: Record<string, Pricing> = {
  "claude-opus-4-7":   { input: 15.0, output: 75.0 },
  "claude-sonnet-4-6": { input:  3.0, output: 15.0 },
  "claude-haiku-4-5":  { input:  1.0, output: 5.0 },
};

const FALLBACK_PRICING: Pricing = PRICING["claude-sonnet-4-6"];

export function tokenCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? FALLBACK_PRICING;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

// ──────────────────────────────────────────────────────────────────────────
// Anthropic Messages API
// ──────────────────────────────────────────────────────────────────────────
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: JsonObj;
}

export interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: JsonObj;
}

export interface AnthropicResponse {
  content: AnthropicContentBlock[];
  usage: { input_tokens: number; output_tokens: number };
  stop_reason: string | null;
}

export interface AnthropicChatRequest {
  model: string;
  system: string;
  tools?: AnthropicTool[];
  messages: JsonObj[];
  max_tokens?: number;
}

export class AnthropicError extends Error {
  constructor(public status: number, public body: string) {
    super(`anthropic_api_error ${status}: ${body}`);
    this.name = "AnthropicError";
  }
}

export async function anthropicChat(req: AnthropicChatRequest): Promise<AnthropicResponse> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: req.model,
      max_tokens: req.max_tokens ?? 1024,
      system: req.system,
      tools: req.tools,
      messages: req.messages,
    }),
  });
  if (!resp.ok) {
    throw new AnthropicError(resp.status, await resp.text());
  }
  const data = await resp.json();
  return {
    content: data.content ?? [],
    usage: {
      input_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
    },
    stop_reason: data.stop_reason ?? null,
  };
}

export function toolUses(resp: AnthropicResponse): AnthropicContentBlock[] {
  return resp.content.filter((b) => b.type === "tool_use");
}

// ──────────────────────────────────────────────────────────────────────────
// agent_runs lifecycle
// ──────────────────────────────────────────────────────────────────────────
export interface OpenRunArgs {
  case_id: string | null;
  agent_name: string;
  model: string;
  triggered_by: string;
}

export async function openRun(supa: SupabaseClient, args: OpenRunArgs): Promise<string | null> {
  const { data } = await supa
    .from("agent_runs")
    .insert({
      case_id: args.case_id,
      agent_name: args.agent_name,
      model: args.model,
      triggered_by: args.triggered_by,
      state: "running",
      turn_count: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cost_usd: 0,
    })
    .select("id")
    .single();
  return (data?.id as string | undefined) ?? null;
}

export interface CloseRunArgs {
  run_id: string;
  state: "complete" | "failed" | "failed_no_terminal";
  terminal_tool?: string | null;
  terminal_reason?: string | null;
  turn_count?: number;
  total_input_tokens?: number;
  total_output_tokens?: number;
  total_cost_usd?: number;
  error_message?: string | null;
}

export async function closeRun(supa: SupabaseClient, args: CloseRunArgs): Promise<void> {
  await supa
    .from("agent_runs")
    .update({
      state: args.state,
      terminal_tool: args.terminal_tool ?? null,
      terminal_reason: args.terminal_reason ?? null,
      turn_count: args.turn_count ?? 0,
      total_input_tokens: args.total_input_tokens ?? 0,
      total_output_tokens: args.total_output_tokens ?? 0,
      total_cost_usd: args.total_cost_usd ?? 0,
      error_message: args.error_message ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", args.run_id);
}

// ──────────────────────────────────────────────────────────────────────────
// HTTP helpers
// ──────────────────────────────────────────────────────────────────────────
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Truncate tool_result payloads before handing them back to the model.
// Keeps each context block bounded so a surprise large row doesn't blow the
// window. 8KB is enough for any agent context row we feed back.
export function clipToolResult(value: unknown, maxChars = 8000): string {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return s.length > maxChars ? s.slice(0, maxChars) : s;
}
