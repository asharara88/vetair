// Read-side helpers for agent_registry / synthesized_specialists.
//
// The registry is the source of truth for "what agents exist in production
// right now". Built-in agents (orchestrator, intake, compliance, auditor,
// comms, synthesizer) are seeded by migration. Specialists are inserted at
// runtime by the Synthesizer agent.
//
// We never use the registry to BUILD an AgentDefinition — definitions are
// in code (lib/agents/<name>.ts). The registry tells us which definitions
// are currently active and gives the UI something to render.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentDefinition } from "./types";

export interface RegistryRow {
  agent_name: string;
  agent_type: string;
  model: string;
  status: "active" | "retired" | "draft";
  user_facing_label: string | null;
  template_id: string | null;
  synthesis_params: Record<string, unknown> | null;
  invocation_count: number;
  created_at: string;
}

export async function listActiveAgents(supabase: SupabaseClient): Promise<RegistryRow[]> {
  const { data, error } = await supabase
    .from("agent_registry")
    .select("agent_name, agent_type, model, status, user_facing_label, template_id, synthesis_params, invocation_count, created_at")
    .eq("status", "active");
  if (error) throw new Error(`agent_registry: ${error.message}`);
  return (data ?? []) as RegistryRow[];
}

export async function ensureRegistered(
  supabase: SupabaseClient,
  def: AgentDefinition,
  agentType: string,
  userFacingLabel: string,
): Promise<void> {
  // Idempotent upsert keyed on agent_name. We don't bump invocation_count
  // here — the runtime increments it after each successful run via SQL.
  await supabase
    .from("agent_registry")
    .upsert(
      {
        agent_name: def.name,
        agent_type: agentType,
        model: def.model,
        status: "active",
        user_facing_label: userFacingLabel,
      },
      { onConflict: "agent_name" },
    );
}
