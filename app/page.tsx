import { LOGO_DARK } from "@/lib/supabase";
import { serverSupabase } from "@/lib/supabase-server";
import { Header } from "@/components/demo/Header";
import { LiveReceipts } from "@/components/demo/LiveReceipts";
import { AgentRegistry } from "@/components/demo/AgentRegistry";
import { AutoRefresh } from "@/components/demo/AutoRefresh";
import { RunDemoButton } from "@/components/demo/RunDemoButton";
import { Panel, Pill } from "@/components/ui/primitives";
import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const supabase = await serverSupabase();

  const [agentsRes, specialistsRes, runsRes, casesRes, costRes] = await Promise.all([
    supabase.from("agent_registry").select("agent_name", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("synthesized_specialists").select("agent_name", { count: "exact", head: true }).is("retired_at", null),
    supabase.from("agent_runs").select("id", { count: "exact", head: true }).eq("state", "complete"),
    supabase.from("cases").select("id", { count: "exact", head: true }).eq("demo_mode", false),
    supabase.from("agent_runs").select("total_cost_usd").eq("state", "complete"),
  ]);

  const agentsLive = agentsRes.count ?? 0;
  const specialistsCount = specialistsRes.count ?? 0;
  const runsCompleted = runsRes.count ?? 0;
  const casesCount = casesRes.count ?? 0;
  const totalCost = (costRes.data ?? []).reduce((acc, r) => acc + Number(r.total_cost_usd ?? 0), 0);

  return (
    <>
      <Header />
      <main className="max-w-[1400px] mx-auto px-6 py-10">
        <section className="mb-12 max-w-3xl">
          <div className="mb-8 flex items-center gap-4">
            <Image src={LOGO_DARK} alt="" width={40} height={40} className="opacity-90" />
            <p className="font-mono text-2xs uppercase tracking-widest text-amber-400">
              Self-extending Multi-Agent System
            </p>
          </div>
          <h1 className="font-display text-5xl lg:text-6xl leading-[1.05] text-ink-100 tracking-tight">
            Pet relocation, run by agents.{" "}
            <span className="text-ink-400 italic">The system writes its own specialists.</span>
          </h1>
          <p className="text-lg text-ink-300 mt-6 leading-relaxed">
            An Orchestrator agent routes every case through Intake, Compliance, and Auditor
            agents. When a case opens for a country no specialist covers, a Synthesizer agent
            compiles a new specialist from a template and registers it at runtime. Built on
            Claude’s tool-use API. Every decision cited. Every turn audited.
          </p>
          <div className="flex items-center gap-2 mt-6 flex-wrap">
            <AutoRefresh intervalMs={5000} label={agentsLive + " agents live"} />
            <Pill tone="amber">{specialistsCount} specialist{specialistsCount === 1 ? "" : "s"} synthesized</Pill>
            <Pill tone="neutral">{runsCompleted} runs completed</Pill>
            <Pill tone="neutral">${totalCost.toFixed(2)} total compute</Pill>
            <Pill tone="neutral">{casesCount} real cases</Pill>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-5 items-start mb-12">
          <div className="space-y-5">
            <AgentRegistry />
            <LiveReceipts />
          </div>

          <div className="space-y-5">
            <Panel eyebrow="Try it" title="Spawn a real case">
              <RunDemoButton />
            </Panel>

            <Panel eyebrow="01 — 04" title="How it works">
              <div className="space-y-5 text-sm text-ink-300 leading-relaxed">
                <div>
                  <p className="font-mono text-2xs uppercase tracking-widest text-amber-400 mb-1.5">01 · Tool-use reasoning loops</p>
                  <p>Every agent runs as a Claude tool-use loop. Multi-turn. Parallel calls when useful. Terminal only via named tools — no prose endings, no hallucinated regulations.</p>
                </div>
                <div>
                  <p className="font-mono text-2xs uppercase tracking-widest text-amber-400 mb-1.5">02 · Inter-agent messaging with dissent</p>
                  <p>Agents communicate through a typed <span className="font-mono">agent_messages</span> table. The Auditor must independently verify the Compliance Agent’s citations; it can concur or dissent. Two rounds of unresolved dissent escalates to human.</p>
                </div>
                <div>
                  <p className="font-mono text-2xs uppercase tracking-widest text-amber-400 mb-1.5">03 · Orchestrator-as-agent</p>
                  <p>Routing is an agent, not a trigger. Postgres queues events; a Sonnet loop reads case state and decides the next step. Budget limits enforced in-agent: 20 invocations, 500K tokens, 2 dissent rounds max per case.</p>
                </div>
                <div>
                  <p className="font-mono text-2xs uppercase tracking-widest text-amber-400 mb-1.5">04 · Self-extending through synthesis</p>
                  <p>When a case needs a jurisdiction no specialist covers, the Synthesizer compiles a template with parameters, validates the tool manifest, and registers a new specialist. First case in a new country pays $0.03 of synthesis; every case after reuses it.</p>
                </div>
              </div>
            </Panel>

            <Panel eyebrow="Walkthrough" title="Deep dives">
              <div className="space-y-2">
                <WalkthroughRow num="01" href="/theater" title="Case Theater" note="Watch a case run turn-by-turn" status="live" />
                <WalkthroughRow num="02" href="/factory" title="Factory" note="Synthesize a new country specialist · coming" status="soon" />
                <WalkthroughRow num="03" href="/architecture" title="Architecture" note="Schema, agents, tools, dispatch chain · coming" status="soon" />
              </div>
            </Panel>
          </div>
        </div>
      </main>

      <footer className="max-w-[1400px] mx-auto px-6 py-10 mt-10 border-t border-ink-700/40">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="font-mono text-2xs uppercase tracking-widest text-ink-500">
            Vetair · Next.js 15 · Supabase · Claude Sonnet 4.5 / Opus 4.5 / Haiku 4.5 · Deployed on Vercel
          </p>
          <a
            href="https://github.com/asharara88/vetair"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-2xs uppercase tracking-widest text-ink-500 hover:text-amber-400 transition-colors"
          >
            Source →
          </a>
        </div>
      </footer>
    </>
  );
}

function WalkthroughRow({ num, href, title, note, status }: {
  num: string; href: string; title: string; note: string; status: "soon" | "live";
}) {
  return (
    <Link href={href} className="flex items-center gap-4 py-2.5 px-2 -mx-2 hover:bg-ink-800/40 transition-colors group">
      <span className="font-mono text-2xs text-ink-500 tabular-nums flex-shrink-0">{num}</span>
      <div className="flex-1 min-w-0">
        <p className="font-display text-ink-100 group-hover:text-amber-400 transition-colors">{title}</p>
        <p className="font-mono text-2xs text-ink-500 mt-0.5 truncate">{note}</p>
      </div>
      <Pill tone={status === "live" ? "go" : "neutral"} dot={status === "live"}>{status}</Pill>
      <span className="font-mono text-ink-500 group-hover:text-amber-400 transition-colors">→</span>
    </Link>
  );
}
