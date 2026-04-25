import { serverSupabase } from "@/lib/supabase-server";
import { Panel, Pill } from "@/components/ui/primitives";

interface RunRow {
  id: string;
  case_id: string;
  agent_name: string;
  model: string;
  state: string;
  terminal_tool: string | null;
  terminal_reason: string | null;
  turn_count: number;
  total_cost_usd: number | string | null;
  completed_at: string | null;
  started_at: string;
}

const TERMINAL_TONE: Record<string, "go" | "ping" | "stop" | "amber" | "neutral"> = {
  emit_assessment: "go", handoff_to_compliance: "go", dispatch_to_agent: "amber",
  ask_user_for_input: "ping", close_case: "go", concur: "go", dissent: "stop",
  escalate_to_human: "stop", register_specialist: "amber", send_reply: "neutral",
  request_document: "neutral", acknowledge_and_wait: "neutral", fail_synthesis: "stop",
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return s + "s ago";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24);
  return d + "d ago";
}

function fmtCost(v: number | string | null): string {
  const n = Number(v ?? 0);
  if (n < 0.01) return "$" + n.toFixed(4);
  return "$" + n.toFixed(3);
}

export async function LiveReceipts() {
  const supabase = await serverSupabase();
  const { data, error } = await supabase
    .from("agent_runs")
    .select("id, case_id, agent_name, model, state, terminal_tool, terminal_reason, turn_count, total_cost_usd, completed_at, started_at")
    .in("state", ["complete", "failed_no_terminal", "failed"])
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(12);

  const runs: RunRow[] = (data ?? []) as RunRow[];

  return (
    <Panel eyebrow="Trail" title="Recent agent runs">
      {error && (
        <p className="font-mono text-2xs text-signal-stop py-6">Trail unavailable: {error.message}</p>
      )}
      {!error && runs.length === 0 && (
        <p className="font-mono text-2xs uppercase tracking-widest text-ink-500 py-8 text-center">No agent runs yet</p>
      )}
      <div className="divide-y divide-ink-700/50">
        {runs.map((r) => {
          const tone =
            r.state === "complete" && r.terminal_tool
              ? TERMINAL_TONE[r.terminal_tool] ?? "neutral"
              : "stop";
          return (
            <div key={r.id} className="flex items-center gap-3 py-2.5">
              <span className="font-mono text-2xs text-ink-500 w-20 flex-shrink-0 tabular-nums">
                {r.completed_at ? timeAgo(r.completed_at) : timeAgo(r.started_at)}
              </span>
              <span className="font-display text-ink-100 text-sm w-36 flex-shrink-0 truncate">
                {r.agent_name}
              </span>
              <Pill tone={tone}>
                {r.state === "complete" ? r.terminal_tool ?? "done" : r.state.replace("_", " ")}
              </Pill>
              <span className="font-mono text-2xs text-ink-500 ml-auto flex-shrink-0 tabular-nums">
                {r.turn_count}t · {fmtCost(r.total_cost_usd)}
              </span>
            </div>
          );
        })}
      </div>
      {runs.length > 0 && (
        <p className="font-mono text-2xs text-ink-500 mt-4 pt-3 border-t border-ink-700/40">
          Every turn of every agent is persisted in{" "}
          <span className="text-ink-400">agent_runs</span> and{" "}
          <span className="text-ink-400">agent_turns</span>. Tool calls, token counts,
          latencies, costs — all SQL-queryable.
        </p>
      )}
    </Panel>
  );
}
