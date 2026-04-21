import { LOGO_DARK } from "@/lib/supabase";
import { serverSupabase } from "@/lib/supabase-server";
import { Header } from "@/components/demo/Header";
import { ControlPanel } from "@/components/demo/ControlPanel";
import { Panel, Pill } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";
import type { Case, DemoScript } from "@/types/database";
import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await serverSupabase();
  const { data: scripts } = await supabase
    .from("demo_scripts")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  const { data: recentCases } = await supabase
    .from("cases")
    .select("id, case_number, origin_country, destination_country, state, demo_mode, target_date, created_at")
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <>
      <Header />
      <main className="max-w-[1400px] mx-auto px-6 py-10">
        {/* Hero */}
        <section className="mb-10 max-w-3xl">
          <div className="mb-8 flex items-center gap-4">
            <Image src={LOGO_DARK} alt="" width={40} height={40} className="opacity-90" />
            <div>
              <p className="font-mono text-2xs uppercase tracking-widest text-amber-400">
                Autonomous Pet Relocation · V1
              </p>
            </div>
          </div>
          <h1 className="font-display text-5xl lg:text-6xl leading-[1.05] text-ink-100 tracking-tight">
            A pet moves between countries.{" "}
            <span className="text-ink-400 italic">Zero human touchpoints.</span>
          </h1>
          <p className="text-lg text-ink-300 mt-6 leading-relaxed">
            Vetair is a polyphonic multi-agent system. A case opens, three
            independent compliance voices reach consensus, specialist agents
            negotiate a feasible timeline, and the full itinerary is delivered
            to the owner on WhatsApp. No operators. No forms. No phone calls.
          </p>
          <div className="flex items-center gap-2 mt-6 flex-wrap">
            <Pill tone="amber">UAE ↔ UK</Pill>
            <Pill tone="neutral">Dog · Cat · Ferret</Pill>
            <Pill tone="go" dot>3 edge functions live</Pill>
            <Pill tone="neutral">37 rules indexed</Pill>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-5 items-start">
          {/* Left: Control */}
          <ControlPanel scripts={(scripts as DemoScript[] | null) ?? []} />

          {/* Right: Recent cases + architecture notes */}
          <div className="space-y-5">
            <Panel eyebrow="Recent" title="Cases">
              {(!recentCases || recentCases.length === 0) && (
                <p className="font-mono text-2xs uppercase tracking-widest text-ink-500 py-8 text-center">
                  No cases yet — launch one on the left
                </p>
              )}
              <div className="divide-y divide-ink-700/50">
                {(recentCases as Partial<Case>[] | null ?? []).map((c) => (
                  <Link
                    key={c.id}
                    href={`/cases/${c.id}`}
                    className="flex items-center gap-4 py-2.5 hover:bg-ink-800/40 px-2 -mx-2 transition-colors"
                  >
                    <span className="font-mono text-2xs text-ink-500 tabular-nums flex-shrink-0 w-32 truncate">
                      {c.case_number}
                    </span>
                    <span className="font-mono text-2xs text-ink-400 flex-shrink-0">
                      {c.origin_country} → {c.destination_country}
                    </span>
                    <StateBadge state={c.state ?? "draft"} />
                    {c.demo_mode && <Pill tone="amber">demo</Pill>}
                    <span className="font-mono text-2xs text-ink-500 ml-auto tabular-nums">
                      {c.created_at && formatDate(c.created_at)}
                    </span>
                  </Link>
                ))}
              </div>
            </Panel>

            <Panel eyebrow="Architecture" title="The three patterns">
              <div className="space-y-4 text-sm text-ink-300 leading-relaxed">
                <div>
                  <p className="font-mono text-2xs uppercase tracking-widest text-amber-400 mb-1">
                    01 · Three-voice compliance spine
                  </p>
                  <p>
                    Every compliance verdict is voted on by a deterministic
                    TypeScript engine, Claude Sonnet 4, and Claude Opus 4.7 with
                    reversed adversarial framing. Disagreement escalates.
                  </p>
                </div>
                <div>
                  <p className="font-mono text-2xs uppercase tracking-widest text-amber-400 mb-1">
                    02 · Consensus timeline loop
                  </p>
                  <p>
                    Vet Network, Airline/Crate, and Endorsement agents negotiate
                    a feasible timeline through a consensus round. No human
                    scheduler.
                  </p>
                </div>
                <div>
                  <p className="font-mono text-2xs uppercase tracking-widest text-amber-400 mb-1">
                    03 · Watchdog audit pattern
                  </p>
                  <p>
                    An Audit Agent runs async, enforcing 100% citation coverage
                    and cross-checking deterministic vs LLM verdicts in real
                    time.
                  </p>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </main>

      <footer className="max-w-[1400px] mx-auto px-6 py-10 mt-10 border-t border-ink-700/40">
        <p className="font-mono text-2xs uppercase tracking-widest text-ink-500">
          Vetair · Mi Casa Real Estate org · Built with Next.js 15 · Supabase ·
          Claude 4 · Deployed on Vercel
        </p>
      </footer>
    </>
  );
}

function StateBadge({ state }: { state: string }) {
  const tone =
    state === "approved" || state === "closed" || state === "arrived" ? "go"
    : state === "blocked" || state === "cancelled" ? "stop"
    : state === "assessment" || state === "intake" ? "ping"
    : "neutral";
  return <Pill tone={tone as "go" | "stop" | "ping" | "neutral"}>{state}</Pill>;
}
