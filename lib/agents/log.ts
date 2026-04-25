// Common agent_logs writer. Every agent's run() calls this exactly once at the end.
// Centralised so the schema column names live in one place.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentName } from "@/types/database";
import type { AgentResult } from "./types";

export async function recordAgentRun(
  supabase: SupabaseClient,
  agent: AgentName,
  case_id: string,
  result: AgentResult,
  extra?: { input_payload?: object | null; output_payload?: object | null },
): Promise<void> {
  const { error } = await supabase.from("agent_logs").insert({
    case_id,
    agent_name: agent,
    model: result.model ?? null,
    input_tokens: result.input_tokens ?? null,
    output_tokens: result.output_tokens ?? null,
    cost_usd: result.cost_usd ?? null,
    latency_ms: result.latency_ms ?? null,
    decision_summary: result.decision_summary.slice(0, 500),
    confidence: result.confidence,
    citations: result.citations,
    input_payload: extra?.input_payload ?? null,
    output_payload: extra?.output_payload ?? result.output ?? null,
    error_message: result.ok ? null : (result.error ?? null),
  });
  if (error) {
    console.error(`[agent:${agent}] failed to write agent_logs:`, error.message);
  }
}
