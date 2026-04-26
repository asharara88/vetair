// Minimal typed Anthropic Messages client for the Vetair MAS.
// Scoped down to what the agent runtime needs: tool-use, system prompt,
// turn-by-turn user content. Streaming and vision live elsewhere
// (lib/document-extract.ts uses its own fetch for clarity).

import "server-only";
import type { AgentModel, AssistantBlock, ToolResultBlock, ToolSchema } from "./types";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string | (AssistantBlock | ToolResultBlock | { type: "text"; text: string })[];
}

export interface ClaudeRequest {
  model: AgentModel;
  system: string;
  tools: ToolSchema[];
  messages: ClaudeMessage[];
  max_tokens: number;
}

export interface ClaudeResponse {
  id: string;
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | string;
  content: AssistantBlock[];
  usage: { input_tokens: number; output_tokens: number };
}

export class AnthropicError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "AnthropicError";
  }
}

export async function callClaude(req: ClaudeRequest): Promise<ClaudeResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AnthropicError(0, "ANTHROPIC_API_KEY not set");

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new AnthropicError(res.status, `Anthropic ${res.status}: ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as ClaudeResponse;
}
