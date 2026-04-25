// Shared types for the lib/agents/* roster.
// Each agent exports `run(ctx)` returning AgentResult, plus a `meta` descriptor.
// The Orchestrator dispatches via the meta.name registry; never imports concrete agents.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentName } from "@/types/database";

export interface AgentContext {
  case_id: string;
  supabase: SupabaseClient;
  // Optional payload from the upstream task_queue row that triggered this run.
  payload?: Record<string, unknown>;
}

export interface Citation {
  requirement_code: string;
  source_url?: string | null;
}

export interface AgentResult<T = unknown> {
  ok: boolean;
  output?: T;
  decision_summary: string;
  confidence: number; // 0..1
  citations: Citation[];
  // Tokens + cost are filled in by the Anthropic wrapper for LLM-backed agents.
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  latency_ms?: number;
  error?: string;
}

export interface AgentMeta {
  name: AgentName;
  description: string;
  // Default Anthropic model id (override via env var ANTHROPIC_<UPPER>_MODEL).
  default_model: string;
  // Soft input-token budget. The wrapper logs a warning if the prompt exceeds.
  input_budget_tokens: number;
}

export type AgentRunner<T = unknown> = (ctx: AgentContext) => Promise<AgentResult<T>>;

export interface AgentModule<T = unknown> {
  meta: AgentMeta;
  run: AgentRunner<T>;
}
