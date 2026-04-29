import { serverSupabase } from "@/lib/supabase-server";
import { Panel, Pill } from "@/components/ui/primitives";
import { modelFamily } from "@/lib/utils";
import {
  agentTypeTone,
  compareAgentRows,
  type AgentRegistryRow,
} from "@/lib/agents/registry-meta";

export async function AgentRegistry() {
  const supabase = await serverSupabase();
  const { data, error } = await supabase
    .from("agent_registry")
    .select("agent_name, agent_type, model, status, user_facing_label, invocation_count, template_id, synthesis_params, created_at")
    .eq("status", "active");

  const agents = ((data ?? []) as AgentRegistryRow[]).slice().sort(compareAgentRows);

  return (
    <Panel eyebrow="Registry" title="Agents live in production">
      {error && (
        <p className="font-mono text-2xs text-signal-stop py-6">Registry unavailable: {error.message}</p>
      )}
      {!error && agents.length === 0 && (
        <p className="font-mono text-2xs uppercase tracking-widest text-ink-500 py-8 text-center">No agents registered</p>
      )}
      <div className="divide-y divide-ink-700/50">
        {agents.map((a) => {
          const isSynth = a.template_id !== null;
          const accent = agentTypeTone(a.agent_type);
          return (
            <div key={a.agent_name} className="flex items-center gap-4 py-3">
              <div className="w-28 flex-shrink-0">
                <Pill tone={accent} dot={a.agent_type === "orchestrator"}>{a.agent_type}</Pill>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-ink-100 truncate">{a.user_facing_label ?? a.agent_name}</span>
                  {isSynth && <span className="font-mono text-2xs uppercase tracking-widest text-amber-400">synthesized</span>}
                </div>
                <p className="font-mono text-2xs text-ink-500 truncate mt-0.5">
                  {a.agent_name}
                  {a.synthesis_params && (
                    <>
                      {" · "}
                      {Object.entries(a.synthesis_params).map(([k, v]) => k + "=" + v).join(", ")}
                    </>
                  )}
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="font-mono text-2xs uppercase tracking-widest text-ink-400">{modelFamily(a.model)}</p>
                <p className="font-mono text-2xs text-ink-500 tabular-nums mt-0.5">
                  {a.invocation_count} {a.invocation_count === 1 ? "call" : "calls"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
