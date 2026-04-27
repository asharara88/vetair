import { Header } from "@/components/demo/Header";
import { AutoRefresh } from "@/components/demo/AutoRefresh";
import { Panel, Pill } from "@/components/ui/primitives";
import { serverSupabase } from "@/lib/supabase-server";
import { formatCost, modelFamily } from "@/lib/utils";

export const metadata = { title: "Architecture · Vetair" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RegistryRow {
  agent_name: string;
  agent_type: string;
  model: string;
  user_facing_label: string | null;
  invocation_count: number;
  template_id: string | null;
  synthesis_params: Record<string, unknown> | null;
  status: string;
}

interface RunStat {
  agent_name: string;
  completed_runs: number;
  failed_runs: number;
  avg_turns: number;
  total_cost: number;
}

const TYPE_ORDER: Record<string, number> = {
  orchestrator: 0, intake: 1, compliance: 2, auditor: 3, synthesizer: 4, specialist: 5,
};

const TYPE_TONE: Record<string, "amber" | "go" | "ping" | "neutral"> = {
  orchestrator: "amber", synthesizer: "amber", auditor: "ping",
  compliance: "go", intake: "neutral", specialist: "amber",
};

const TYPE_BLURB: Record<string, string> = {
  orchestrator: "Reads case state from the queue and decides which agent to dispatch next. Enforces the per-case budget (turns, dissent rounds, total tokens).",
  intake: "Conversational onboarding via WhatsApp. Captures owner + pet + intent. One question per turn, never multi-prompts.",
  compliance: "Primary compliance voice. Reasons over case data + country rules; emits an assessment with citations and missing requirements.",
  auditor: "Adversarial reviewer. Re-reads the compliance assessment with reverse framing and either concurs or dissents with challenges.",
  synthesizer: "Self-extension. Compiles a parameterized template into a runtime specialist when a case opens for an uncovered country.",
  specialist: "Synthesized at runtime by the Synthesizer. Country-scoped compliance variant that inherits the compliance loop with a jurisdiction-specific prompt.",
};

const TABLE_GROUPS: { title: string; description: string; tables: { name: string; note: string }[] }[] = [
  {
    title: "Cases",
    description: "Owner, pet, and case lifecycle.",
    tables: [
      { name: "owners", note: "WhatsApp + locale + residence/destination" },
      { name: "pets", note: "Species, breed, microchip, DOB, weight" },
      { name: "cases", note: "Lifecycle state machine, demo_mode flag" },
      { name: "documents", note: "Uploaded artifacts + extracted fields" },
    ],
  },
  {
    title: "Compliance ground truth",
    description: "The rule graph agents must cite from. Inventing rules is forbidden by prompt.",
    tables: [
      { name: "country_rules", note: "Per-corridor requirement codes + evaluator function names" },
      { name: "breed_restrictions", note: "Destination-specific breed bans / quarantines" },
      { name: "compliance_assessments", note: "Output of every compliance run, with citations" },
      { name: "audit_reviews", note: "Auditor concur/dissent verdicts on assessments" },
    ],
  },
  {
    title: "Agent runtime",
    description: "Persistent audit trail of every reasoning loop.",
    tables: [
      { name: "agent_registry", note: "Source of truth for dispatchable agents" },
      { name: "agent_templates", note: "Blueprints the Synthesizer compiles from" },
      { name: "synthesized_specialists", note: "Runtime-created specialists, deduped by params hash" },
      { name: "agent_runs", note: "One row per reasoning loop (start → terminal tool)" },
      { name: "agent_turns", note: "One row per Claude call AND per tool result" },
      { name: "agent_messages", note: "Inter-agent communication payload" },
      { name: "orchestrator_queue", note: "Wakes the Orchestrator on case events" },
    ],
  },
  {
    title: "Comms",
    description: "Owner-facing channels.",
    tables: [
      { name: "comms_messages", note: "WhatsApp / email / SMS thread, all directions" },
      { name: "whatsapp_webhook_events", note: "Raw inbound from Meta, signature-verified" },
    ],
  },
];

export default async function Architecture() {
  const supabase = await serverSupabase();

  const [regRes, runsRes] = await Promise.all([
    supabase.from("agent_registry")
      .select("agent_name, agent_type, model, user_facing_label, invocation_count, template_id, synthesis_params, status")
      .eq("status", "active"),
    supabase.from("agent_runs")
      .select("agent_name, state, turn_count, total_cost_usd"),
  ]);

  const registry = (regRes.data ?? []) as RegistryRow[];
  registry.sort((a, b) => {
    const ao = TYPE_ORDER[a.agent_type] ?? 99;
    const bo = TYPE_ORDER[b.agent_type] ?? 99;
    if (ao !== bo) return ao - bo;
    return a.agent_name.localeCompare(b.agent_name);
  });

  const stats = new Map<string, RunStat>();
  type RawRun = { agent_name: string; state: string; turn_count: number | null; total_cost_usd: number | string | null };
  for (const r of (runsRes.data ?? []) as RawRun[]) {
    const cur = stats.get(r.agent_name) ?? {
      agent_name: r.agent_name, completed_runs: 0, failed_runs: 0, avg_turns: 0, total_cost: 0,
    };
    if (r.state === "complete") {
      cur.completed_runs += 1;
      cur.avg_turns += r.turn_count ?? 0;
      cur.total_cost += Number(r.total_cost_usd ?? 0);
    } else if (r.state === "failed" || r.state === "failed_no_terminal") {
      cur.failed_runs += 1;
    }
    stats.set(r.agent_name, cur);
  }
  for (const s of stats.values()) {
    if (s.completed_runs > 0) s.avg_turns = +(s.avg_turns / s.completed_runs).toFixed(1);
  }

  const dispatchChain: { label: string; tone: "neutral" | "amber" | "go" | "ping"; mono: boolean }[] = [
    { label: "WhatsApp inbound", tone: "neutral", mono: true },
    { label: "orchestrator_queue", tone: "neutral", mono: true },
    { label: "Orchestrator", tone: "amber", mono: false },
    { label: "Intake", tone: "neutral", mono: false },
    { label: "Compliance", tone: "go", mono: false },
    { label: "Auditor", tone: "ping", mono: false },
    { label: "Specialist (synthesized)", tone: "amber", mono: false },
    { label: "Comms → owner", tone: "neutral", mono: true },
  ];

  return (
    <>
      <Header />
      <main className="max-w-[1400px] mx-auto px-6 py-10">
        <section className="mb-10 max-w-3xl">
          <p className="font-mono text-2xs uppercase tracking-widest text-amber-400 mb-3">
            Walkthrough 03 · Architecture
          </p>
          <h1 className="font-display text-4xl lg:text-5xl leading-[1.05] text-ink-100 tracking-tight">
            The receipts.
          </h1>
          <p className="text-lg text-ink-300 mt-5 leading-relaxed">
            Schema, agents, dispatch chain — laid out for the engineer in the follow-up
            meeting. Everything that makes the MAS work, in SQL-queryable form.
          </p>
          <div className="flex items-center gap-2 mt-5 flex-wrap">
            <AutoRefresh intervalMs={6000} label="Live · 6s" />
            <Pill tone="amber">{registry.length} agents in registry</Pill>
            <Pill tone="neutral">
              {TABLE_GROUPS.reduce((acc, g) => acc + g.tables.length, 0)} tables
            </Pill>
          </div>
        </section>

        <Panel eyebrow="Dispatch" title="The chain">
          <div className="overflow-x-auto pb-2">
            <div className="flex items-center gap-2 min-w-max">
              {dispatchChain.map((step, i) => (
                <div key={step.label} className="flex items-center gap-2">
                  <Pill tone={step.tone} dot={step.tone === "amber"}>
                    <span className={step.mono ? "font-mono" : ""}>{step.label}</span>
                  </Pill>
                  {i < dispatchChain.length - 1 && <span className="font-mono text-ink-500">→</span>}
                </div>
              ))}
            </div>
          </div>
          <p className="text-sm text-ink-300 leading-relaxed mt-4">
            Every transition is a row insert: a Claude tool call writes to a typed table,
            a Postgres trigger wakes the Orchestrator, the Orchestrator decides whether to
            dispatch the next agent or close the case. No external job queue — Postgres is
            the bus.
          </p>
        </Panel>

        <Panel eyebrow="Roster" title="Active agents" className="mt-5">
          <div className="space-y-3">
            {registry.map((a) => {
              const stat = stats.get(a.agent_name);
              const tone = TYPE_TONE[a.agent_type] ?? "neutral";
              const cc = (a.synthesis_params?.country_code as string | undefined)?.toUpperCase();
              return (
                <div key={a.agent_name} className="border border-ink-700/50 bg-ink-900/20 p-4">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <div className="flex items-baseline gap-3">
                      <Pill tone={tone} dot={a.agent_type === "orchestrator"}>{a.agent_type}</Pill>
                      <span className="font-display text-ink-100">{a.user_facing_label ?? a.agent_name}</span>
                      {cc && (
                        <span className="font-mono text-2xs uppercase tracking-widest text-amber-400">
                          {cc}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-2xs text-ink-500 tabular-nums">
                      {modelFamily(a.model)}
                    </span>
                  </div>
                  <p className="font-mono text-2xs text-ink-500 mt-1">{a.agent_name}</p>
                  {TYPE_BLURB[a.agent_type] && (
                    <p className="text-sm text-ink-300 leading-relaxed mt-3">
                      {TYPE_BLURB[a.agent_type]}
                    </p>
                  )}
                  {stat && stat.completed_runs > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-ink-700/40">
                      <Pill tone="neutral">{stat.completed_runs} run{stat.completed_runs === 1 ? "" : "s"}</Pill>
                      <Pill tone="neutral">{stat.avg_turns} turns avg</Pill>
                      <Pill tone="neutral">{formatCost(stat.total_cost)} total</Pill>
                      {stat.failed_runs > 0 && <Pill tone="stop">{stat.failed_runs} failed</Pill>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5 items-start">
          {TABLE_GROUPS.map((g) => (
            <Panel key={g.title} eyebrow="Schema" title={g.title}>
              <p className="text-sm text-ink-300 leading-relaxed mb-4">{g.description}</p>
              <div className="divide-y divide-ink-700/50">
                {g.tables.map((t) => (
                  <div key={t.name} className="py-2.5 flex items-baseline gap-4">
                    <span className="font-mono text-sm text-amber-400 w-44 flex-shrink-0">
                      {t.name}
                    </span>
                    <span className="text-sm text-ink-300">{t.note}</span>
                  </div>
                ))}
              </div>
            </Panel>
          ))}
        </div>

        <Panel eyebrow="Guarantees" title="What the system will not do" className="mt-5">
          <ul className="space-y-3 text-sm text-ink-300 leading-relaxed">
            <li className="flex items-start gap-3">
              <span className="font-mono text-2xs text-amber-400 mt-0.5">01</span>
              <span>
                Cite a country rule that is not in <span className="font-mono text-amber-400">country_rules</span>.
                Compliance prompts forbid invented requirement codes.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="font-mono text-2xs text-amber-400 mt-0.5">02</span>
              <span>
                Close a case where the Auditor dissents twice without escalating to a human.
                Two dissent rounds is the hard cap, enforced in-Orchestrator.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="font-mono text-2xs text-amber-400 mt-0.5">03</span>
              <span>
                Run more than 20 invocations or burn more than 500K tokens on a single case.
                Budget exhaustion routes the case to a human queue instead of looping.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="font-mono text-2xs text-amber-400 mt-0.5">04</span>
              <span>
                Synthesize a duplicate specialist. Dedup is enforced at the row level via{" "}
                <span className="font-mono text-amber-400">synthesis_params_hash</span>.
              </span>
            </li>
          </ul>
        </Panel>
      </main>
    </>
  );
}
