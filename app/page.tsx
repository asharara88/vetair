import Link from "next/link";
import Image from "next/image";
import { serverSupabase } from "@/lib/supabase-server";
import { Header } from "@/components/demo/Header";
import { AutoRefresh } from "@/components/demo/AutoRefresh";
import { Panel, Pill, Button } from "@/components/ui/primitives";
import { assessmentStateTone, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RecentCase {
  id: string;
  case_number: string;
  origin_country: string;
  destination_country: string;
  assessment_state: string;
  created_at: string;
  pets: { name: string | null; breed: string | null } | null;
}

// ─────────────────────────────────────────────────────────────────────────
// Steps shown in "How it works" preview on landing.
// Plain-language, customer-side journey — NOT implementation detail.
// Detail page lives at /how-it-works.
// ─────────────────────────────────────────────────────────────────────────
const JOURNEY_STEPS = [
  { num: "01", title: "Tell us about your pet on WhatsApp",      note: "Name, breed, route, target date." },
  { num: "02", title: "Our agents check the rules",              note: "Country imports, breed bans, vaccine windows." },
  { num: "03", title: "We coordinate vets and paperwork",        note: "Real bookings via partner clinics and state vets." },
  { num: "04", title: "Your pet flies",                          note: "IATA-approved cargo, tracked door-to-door." },
];

export default async function Home() {
  const supabase = await serverSupabase();

  const [casesCountRes, runsCountRes, corridorsRes, recentCasesRes] = await Promise.all([
    supabase.from("cases").select("id", { count: "exact", head: true }).eq("demo_mode", false),
    supabase.from("agent_runs").select("id", { count: "exact", head: true }).eq("state", "complete"),
    supabase.from("cases").select("origin_country, destination_country").eq("demo_mode", false),
    supabase
      .from("cases")
      .select("id, case_number, origin_country, destination_country, assessment_state, created_at, pets(name, breed)")
      .eq("demo_mode", false)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const casesHandled = casesCountRes.count ?? 0;
  const agentRuns    = runsCountRes.count ?? 0;
  const corridors    = new Set(
    (corridorsRes.data ?? []).map(
      (c: { origin_country: string; destination_country: string }) =>
        `${c.origin_country}-${c.destination_country}`
    )
  ).size;
  const recentCases = (recentCasesRes.data ?? []) as unknown as RecentCase[];

  return (
    <>
      <Header />

      <main className="max-w-[1200px] mx-auto px-6 py-12 md:py-16">

        {/* ─────────────────────────────────────────────────────────────
            HERO — plain-language. Answers "what does this do" in one read.
            ───────────────────────────────────────────────────────────── */}
        <section className="max-w-3xl mb-16">
          <p className="font-mono text-2xs uppercase tracking-widest text-brand-500 mb-4">
            Vetair · Autonomous pet relocation
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-semibold leading-[1.05] tracking-tight text-ink-100">
            Move your pet across borders.
            <br />
            <span className="text-ink-400">Without the paperwork hell.</span>
          </h1>
          <p className="text-lg md:text-xl text-ink-300 mt-6 leading-relaxed max-w-2xl">
            AI agents handle compliance, vet bookings, and airline cargo end-to-end.
            We&apos;ve handled <span className="text-ink-100 font-medium">{casesHandled} cases</span> across{" "}
            <span className="text-ink-100 font-medium">{corridors} corridors</span> with zero human dispatchers.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-8">
            <Link href="/cases">
              <Button variant="primary">▶ Watch live cases</Button>
            </Link>
            <Link href="/how-it-works">
              <Button variant="secondary">How it works</Button>
            </Link>
            <Link href="/architecture">
              <Button variant="ghost">For engineers ↗</Button>
            </Link>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            LIVE CASES — proof, above the fold.
            ───────────────────────────────────────────────────────────── */}
        <section className="mb-16">
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="font-mono text-2xs uppercase tracking-widest text-ink-400 mb-1">
                Recent activity
              </p>
              <h2 className="text-lg font-medium text-ink-100">Real cases, real outcomes</h2>
            </div>
            <div className="flex items-center gap-2">
              <AutoRefresh intervalMs={6000} label="Live · 6s" />
              <Link href="/cases" className="font-mono text-2xs uppercase tracking-widest text-ink-400 hover:text-brand-500 transition-colors">
                See all →
              </Link>
            </div>
          </div>

          <div className="border border-ink-700/60 bg-ink-900/40 divide-y divide-ink-700/40">
            {recentCases.length === 0 ? (
              <div className="px-5 py-8 text-center text-ink-500 font-mono text-2xs uppercase tracking-widest">
                No cases yet
              </div>
            ) : (
              recentCases.map((c) => (
                <Link
                  key={c.id}
                  href={`/cases/${c.id}`}
                  className="block px-5 py-4 hover:bg-ink-800/30 transition-colors group"
                >
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="font-mono text-2xs uppercase tracking-widest text-ink-400 w-44 flex-shrink-0 group-hover:text-brand-500 transition-colors">
                      {c.case_number}
                    </span>
                    <span className="text-sm text-ink-100 flex-1 min-w-0 truncate">
                      {c.pets?.name ?? "Unnamed"}
                      {c.pets?.breed && (
                        <span className="text-ink-400"> · {c.pets.breed}</span>
                      )}
                    </span>
                    <span className="font-mono text-2xs text-ink-400 hidden sm:inline">
                      {c.origin_country} → {c.destination_country}
                    </span>
                    <Pill tone={assessmentStateTone(c.assessment_state)}>
                      {c.assessment_state.replace(/_/g, " ")}
                    </Pill>
                    <span className="font-mono text-2xs text-ink-500 w-16 text-right tabular-nums hidden sm:inline">
                      {timeAgo(c.created_at)}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            JOURNEY — what the customer experiences. Plain English.
            ───────────────────────────────────────────────────────────── */}
        <section className="mb-16">
          <div className="mb-6">
            <p className="font-mono text-2xs uppercase tracking-widest text-ink-400 mb-1">
              How it works
            </p>
            <h2 className="text-lg font-medium text-ink-100">Four steps, end-to-end</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-ink-700/60 border border-ink-700/60">
            {JOURNEY_STEPS.map((step) => (
              <div key={step.num} className="bg-[var(--bg)] p-5">
                <div className="font-mono text-2xs uppercase tracking-widest text-brand-500 mb-3">
                  {step.num}
                </div>
                <h3 className="text-ink-100 font-medium mb-1.5 leading-snug">
                  {step.title}
                </h3>
                <p className="text-sm text-ink-400 leading-relaxed">{step.note}</p>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <Link href="/how-it-works" className="font-mono text-2xs uppercase tracking-widest text-ink-400 hover:text-brand-500 transition-colors">
              Read the full process →
            </Link>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            AUDIENCE-SPECIFIC ENTRYPOINTS
            ───────────────────────────────────────────────────────────── */}
        <section className="mb-16">
          <div className="mb-6">
            <p className="font-mono text-2xs uppercase tracking-widest text-ink-400 mb-1">
              Go deeper
            </p>
            <h2 className="text-lg font-medium text-ink-100">What are you here for?</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-ink-700/60 border border-ink-700/60">
            <Link href="/how-it-works" className="bg-[var(--bg)] p-6 hover:bg-ink-800/30 transition-colors group">
              <div className="font-mono text-2xs uppercase tracking-widest text-brand-500 mb-3">
                For pet owners
              </div>
              <h3 className="text-ink-100 font-medium mb-2 group-hover:text-brand-500 transition-colors">
                Move your pet abroad →
              </h3>
              <p className="text-sm text-ink-400 leading-relaxed">
                See exactly what we handle, what you handle, and how long it takes.
                Currently serving UAE ↔ UK, with EU and US corridors next.
              </p>
            </Link>

            <Link href="/cases" className="bg-[var(--bg)] p-6 hover:bg-ink-800/30 transition-colors group">
              <div className="font-mono text-2xs uppercase tracking-widest text-brand-500 mb-3">
                For investors
              </div>
              <h3 className="text-ink-100 font-medium mb-2 group-hover:text-brand-500 transition-colors">
                Watch the system run →
              </h3>
              <p className="text-sm text-ink-400 leading-relaxed">
                Live cases. Real money, real pets, real outcomes.
                {" "}{agentRuns} completed agent runs and counting.
              </p>
            </Link>

            <Link href="/architecture" className="bg-[var(--bg)] p-6 hover:bg-ink-800/30 transition-colors group">
              <div className="font-mono text-2xs uppercase tracking-widest text-brand-500 mb-3">
                For engineers
              </div>
              <h3 className="text-ink-100 font-medium mb-2 group-hover:text-brand-500 transition-colors">
                See the architecture →
              </h3>
              <p className="text-sm text-ink-400 leading-relaxed">
                14-agent system. Self-extending: Synthesizer agent writes new
                country specialists at runtime. Postgres is the bus.
              </p>
            </Link>
          </div>
        </section>
      </main>

      <footer className="max-w-[1200px] mx-auto px-6 py-8 border-t border-ink-700/40">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="font-mono text-2xs uppercase tracking-widest text-ink-500">
            Vetair · Next.js · Supabase · Claude · Deployed on Vercel
          </p>
          <a
            href="https://github.com/asharara88/vetair"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-2xs uppercase tracking-widest text-ink-500 hover:text-brand-500 transition-colors"
          >
            Source →
          </a>
        </div>
      </footer>
    </>
  );
}
