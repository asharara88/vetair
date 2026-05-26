// Shared Supabase service-role client + agent_runs / agent_turns helpers.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { JsonObj } from "./anthropic.ts";

export function serviceRoleClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface OpenRunArgs {
  case_id: string | null;
  agent_name: string;
  model: string;
  triggered_by: string;
}

export async function openAgentRun(
  supa: SupabaseClient,
  args: OpenRunArgs,
): Promise<string | null> {
  const { data } = await supa
    .from("agent_runs")
    .insert({
      ...args,
      state: "running",
      turn_count: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cost_usd: 0,
    })
    .select("id")
    .single();
  return data?.id ?? null;
}

export interface CloseRunArgs {
  state: "complete" | "failed" | "failed_no_terminal";
  terminal_tool: string | null;
  terminal_reason: string | null;
  turn_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  error_message?: string;
}

export async function closeAgentRun(
  supa: SupabaseClient,
  runId: string | null,
  args: CloseRunArgs,
): Promise<void> {
  if (!runId) return;
  await supa
    .from("agent_runs")
    .update({ ...args, completed_at: new Date().toISOString() })
    .eq("id", runId);
}

export interface TurnRecord {
  run_id: string;
  turn_index: number;
  kind: "assistant" | "tool_result";
  stop_reason?: string;
  content: unknown;
  tool_calls?: JsonObj[];
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  latency_ms?: number;
}

export async function recordTurn(supa: SupabaseClient, turn: TurnRecord): Promise<void> {
  await supa.from("agent_turns").insert(turn);
}
