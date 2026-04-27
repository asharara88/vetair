import { Header } from "@/components/demo/Header";
import { AutoRefresh } from "@/components/demo/AutoRefresh";
import { Panel, Pill } from "@/components/ui/primitives";
import { serverSupabase } from "@/lib/supabase-server";
import { formatCost, modelFamily, timeAgo } from "@/lib/utils";

export const metadata = { title: "Factory · Vetair" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Template {
  id: string;
  namespace: string;
  name: string;
  version: number;
  description: string | null;
  model_tier: string;
  required_params: string[] | null;
  created_by_agent: string | null;
  created_at: string;
}

interface Specialist {
  agent_name: string;
  template_id: string;
  synthesis_params: Record<string, unknown> | null;
  synthesis_params_hash: string | null;
  synthesized_by_run_id: string | null;
  invocation_count: number;
  last_invoked_at: string | null;
  created_at: string;
  retired_at: string | null;
}

interface SynthesisRun {
  id: string;
  agent_name: string;
  state: string;
  terminal_tool: string | null;
  total_cost_usd: number | string | null;
  turn_count: number;
  started_at: string;
  completed_at: string | null;
}

export default async function Factory() {
  const supabase = await serverSupabase();

  const [tplRes, specRes, runsRes, casesRes] = await Promise.all([
    supabase.from("agent_templates")
      .select("id, namespace, name, version, description, model_tier, required_params, created_by_agent, created_at")
      .order("created_at", { ascending: true }),
    supabase.from("synthesized_specialists")
      .select("agent_name, template_id, synthesis_params, synthesis_params_hash, synthesized_by_run_id, invocation_count, last_invoked_at, created_at, retired_at")
      .order("created_at", { ascending: false }),
    supabase.from("agent_runs")
      .select("id, agent_name, state, terminal_tool, total_cost_usd, turn_count, started_at, completed_at")
      .eq("agent_name", "synthesizer")
      .order("started_at", { ascending: false })
      .limit(8),
    supabase.from("cases")
      .select("destination_country")
      .eq("demo_mode", false),
  ]);

  const templates = (tplRes.data ?? []) as Template[];
  const specialists = (specRes.data ?? []) as Specialist[];
  const synthRuns = (runsRes.data ?? []) as SynthesisRun[];
  const caseCountries = (casesRes.data ?? []) as { destination_country: string }[];

  const liveSpecialists = specialists.filter((s) => s.retired_at === null);
  const totalInvocations = liveSpecialists.reduce((acc, s) => acc + (s.invocation_count ?? 0), 0);
  const totalSynthCost = synthRuns.reduce((acc, r) => acc + Number(r.total_cost_usd ?? 0), 0);

  const coveredCountries = new Set(
    liveSpecialists
      .map((s) => (s.synthesis_params?.country_code as string | undefined)?.toUpperCase())
      .filter((c): c is string => !!c),
  );
  const seenCountries = new Set(
    caseCountries.map((c) => c.destination_country?.toUpperCase()).filter(Boolean),
  );
  const uncoveredCountries = Array.from(seenCountries).filter((c) => !coveredCountries.has(c));

  return (
    <>
      <Header />
      <main className="max-w-[1400px] mx-auto px-6 py-10">
        <section className="mb-10 max-w-3xl">
          <p className="font-mono text-2xs uppercase tracking-widest text-amber-400 mb-3">
            Walkthrough 02 · Factory
          </p>
          <h1 className="font-display text-4xl lg:text-5xl leading-[1.05] text-ink-100 tracking-tight">
            The system writes its own specialists.
          </h1>
          <p className="text-lg text-ink-300 mt-5 leading-relaxed">
            When a case opens for a country no specialist covers, the Synthesizer agent reads
            a template, validates the tool manifest, and registers a new specialist at runtime.
            First case pays the synthesis cost — every case after reuses the row.
          </p>
          <div className="flex items-center gap-2 mt-5 flex-wrap">
            <AutoRefresh intervalMs={6000} label="Live · 6s" />
            <Pill tone="amber">{templates.length} template{templates.length === 1 ? "" : "s"}</Pill>
            <Pill tone="go" dot>{liveSpecialists.length} specialists synthesized</Pill>
            <Pill tone="neutral">{totalInvocations} specialist invocation{totalInvocations === 1 ? "" : "s"}</Pill>
            <Pill tone="neutral">{formatCost(totalSynthCost)} synthesis spend</Pill>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <div className="space-y-5">
            <Panel eyebrow="Blueprints" title="agent_templates">
              {templates.length === 0 && (
                <p className="font-mono text-2xs uppercase tracking-widest text-ink-500 py-8 text-center">
                  No templates registered
                </p>
              )}
              <div className="space-y-4">
                {templates.map((t) => (
                  <div key={t.id} className="border border-ink-700/50 bg-ink-900/20 p-4">
                    <div className="flex items-baseline justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-mono text-2xs uppercase tracking-widest text-amber-400">
                          {t.namespace}
                        </p>
                        <p className="font-display text-ink-100 mt-1">{t.name}</p>
                      </div>
                      <Pill tone="neutral">v{t.version} · {modelFamily(t.model_tier)}</Pill>
                    </div>
                    {t.description && (
                      <p className="text-sm text-ink-300 mt-3 leading-relaxed">{t.description}</p>
                    )}
                    {t.required_params && t.required_params.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-ink-700/40">
                        <p className="font-mono text-2xs uppercase tracking-widest text-ink-500 mb-2">
                          Required params
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {t.required_params.map((p) => (
                            <span key={p} className="font-mono text-2xs px-2 py-0.5 border border-ink-700 text-ink-300">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel eyebrow="Coverage" title="What the registry doesn't yet cover">
              {uncoveredCountries.length === 0 ? (
                <p className="font-mono text-2xs uppercase tracking-widest text-ink-500 py-8 text-center">
                  Every destination seen in real cases has a live specialist
                </p>
              ) : (
                <>
                  <p className="text-sm text-ink-300 leading-relaxed mb-4">
                    Cases have opened for these countries but no specialist exists yet. The next
                    case for any of them will trigger synthesis.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {uncoveredCountries.map((c) => (
                      <Pill key={c} tone="ping" dot>{c}</Pill>
                    ))}
                  </div>
                </>
              )}
            </Panel>
          </div>

          <div className="space-y-5">
            <Panel eyebrow="Output" title="synthesized_specialists">
              {liveSpecialists.length === 0 && (
                <p className="font-mono text-2xs uppercase tracking-widest text-ink-500 py-8 text-center">
                  No specialists synthesized yet
                </p>
              )}
              <div className="divide-y divide-ink-700/50">
                {liveSpecialists.map((s) => {
                  const cc = (s.synthesis_params?.country_code as string | undefined)?.toUpperCase() ?? "??";
                  const cn = (s.synthesis_params?.country_name as string | undefined) ?? s.agent_name;
                  return (
                    <div key={s.agent_name} className="py-3 flex items-center gap-4">
                      <div className="w-10 flex-shrink-0">
                        <Pill tone="amber" dot>{cc}</Pill>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-ink-100 truncate">{cn}</p>
                        <p className="font-mono text-2xs text-ink-500 truncate mt-0.5">
                          {s.agent_name}
                          {s.synthesis_params_hash && (
                            <> · #{s.synthesis_params_hash.slice(0, 8)}</>
                          )}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="font-mono text-2xs text-ink-300 tabular-nums">
                          {s.invocation_count} call{s.invocation_count === 1 ? "" : "s"}
                        </p>
                        <p className="font-mono text-2xs text-ink-500 mt-0.5">
                          {s.last_invoked_at
                            ? timeAgo(s.last_invoked_at)
                            : "spawned " + timeAgo(s.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel eyebrow="History" title="Synthesizer runs">
              {synthRuns.length === 0 ? (
                <p className="font-mono text-2xs uppercase tracking-widest text-ink-500 py-8 text-center">
                  Synthesizer hasn't run yet
                </p>
              ) : (
                <div className="space-y-2">
                  {synthRuns.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 py-1.5">
                      <span className="font-mono text-2xs text-ink-500 w-20 flex-shrink-0 tabular-nums">
                        {timeAgo(r.completed_at ?? r.started_at)}
                      </span>
                      <Pill
                        tone={
                          r.terminal_tool === "register_specialist" ? "go" :
                          r.terminal_tool === "fail_synthesis" ? "stop" :
                          r.state === "running" ? "amber" : "neutral"
                        }
                      >
                        {r.terminal_tool ?? r.state}
                      </Pill>
                      <span className="font-mono text-2xs text-ink-500 ml-auto flex-shrink-0 tabular-nums">
                        {r.turn_count}t · {formatCost(r.total_cost_usd)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel eyebrow="Mechanics" title="What synthesis costs">
              <div className="space-y-3 text-sm text-ink-300 leading-relaxed">
                <p>
                  A synthesis run is a Claude tool-use loop with a small fixed scope:
                  list templates → read the chosen one → check for an existing specialist
                  with identical params → register if none. Most runs terminate in 3–5
                  turns.
                </p>
                <p>
                  Dedup is enforced by <span className="font-mono text-amber-400">synthesis_params_hash</span>.
                  Re-synthesis with identical params returns the existing row instead of
                  inserting a new one — so the second case for any country is free.
                </p>
              </div>
            </Panel>
          </div>
        </div>
      </main>
    </>
  );
}
