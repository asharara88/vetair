// Shared Anthropic Messages API client for Vetair edge functions.
// Centralizes: model pricing, fetch boilerplate, token accounting, error shape.

export type JsonObj = Record<string, unknown>;

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: unknown;
}

export interface AnthropicCallParams {
  model: string;
  system: string;
  messages: AnthropicMessage[];
  tools?: AnthropicTool[];
  max_tokens?: number;
}

export interface AnthropicCallResult {
  content: JsonObj[];
  stop_reason: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
}

// USD per 1M tokens. Keep in sync with https://www.anthropic.com/pricing.
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-7": { input: 15, output: 75 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 0.8, output: 4 },
};

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model];
  if (!p) return 0;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export async function callAnthropic(
  apiKey: string,
  params: AnthropicCallParams,
): Promise<AnthropicCallResult> {
  const started = Date.now();
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.max_tokens ?? 1024,
      system: params.system,
      tools: params.tools,
      messages: params.messages,
    }),
  });
  const latency_ms = Date.now() - started;
  if (!res.ok) {
    const detail = await res.text();
    throw new AnthropicApiError(res.status, detail);
  }
  const body = await res.json();
  const input_tokens = body.usage?.input_tokens ?? 0;
  const output_tokens = body.usage?.output_tokens ?? 0;
  return {
    content: (body.content ?? []) as JsonObj[],
    stop_reason: body.stop_reason ?? "end_turn",
    input_tokens,
    output_tokens,
    cost_usd: costUsd(params.model, input_tokens, output_tokens),
    latency_ms,
  };
}

export class AnthropicApiError extends Error {
  constructor(public readonly status: number, public readonly detail: string) {
    super(`anthropic_api_error ${status}: ${detail.slice(0, 200)}`);
  }
}

export function findToolUses(content: JsonObj[]): JsonObj[] {
  return content.filter((b) => b.type === "tool_use");
}

export function findTerminal(content: JsonObj[], terminals: readonly string[]): JsonObj | undefined {
  return findToolUses(content).find((t) => terminals.includes(t.name as string));
}
