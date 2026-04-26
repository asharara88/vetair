import { Header } from "@/components/demo/Header";
import { AutoRefresh } from "@/components/demo/AutoRefresh";
import { CaseTimeline } from "@/components/demo/CaseTimeline";
import { Panel, Pill } from "@/components/ui/primitives";
import { serverSupabase } from "@/lib/supabase-server";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface CaseListRow {
  id: string;
  case_number: string;
  origin_country: string;
  destination_country: string;
  assessment_state: string;
  created_at: string;
  state: string;
}

export default async function TheaterIndex({ searchParams }: { searchParams: Promise<{ case?: string }> }) {
  const { case: caseIdParam } = await searchParams;
  const supabase = await serverSupabase();

  let targetCaseId = caseIdParam;
  if (!targetCaseId) {
    const { data: latest } = await supabase
      .from("cases")
      .select("id")
      .eq("demo_mode", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    targetCaseId = latest?.id ?? "0afd24a9-b274-4985-97a8-8b18d9640d36";
  }

  const { data: recentCases } = await supabase
    .from("cases")
    .select("id, case_number, origin_country, destination_country, assessment_state, created_at, state")
    .eq("demo_mode", false)
    .order("created_at", { ascending: false })
    .limit(12);

  const { data: costs } = await supabase
    .from("agent_runs")
    .select("total_cost_usd")
    .eq("case_id", targetCaseId);
  const totalCost = (costs ?? []).reduce(
    (a: number, r: { total_cost_usd: number | string | null }) => a + Number(r.total_cost_usd ?? 0),
    0,
  );

  return (
    <>
      <Header />
      <main className="max-w-[1400px] mx-auto px-6 py-10">
        <section className="mb-8 max-w-3xl">
          <p className="font-mono text-2xs uppercase tracking-widest text-amber-400 mb-3">
            Walkthrough 01 · Case Theater
          </p>
          <h1 className="font-display text-4xl lg:text-5xl leading-[1.05] text-ink-100 tracking-tight">
            Watch a case unfold, agent by agent.
          </h1>
          <p className="text-lg text-ink-300 mt-5 leading-relaxed">
            Every agent run is persisted with its tool calls, token counts, latencies, and verdicts.
            This page replays them in order — exactly as they happened, with the inter-agent
            messages between them.
          </p>
          <div className="flex items-center gap-2 mt-5 flex-wrap">
            <AutoRefresh intervalMs={4000} label="Live · 4s" />
            <Pill tone="neutral">${totalCost.toFixed(3)} cumulative compute</Pill>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.5fr)] gap-5 items-start">
          <Panel eyebrow="Cases" title="Pick one">
            <div className="divide-y divide-ink-700/50">
              {(recentCases ?? []).map((c: CaseListRow) => {
                const active = c.id === targetCaseId;
                return (
                  <Link
                    key={c.id}
                    href={"/theater?case=" + c.id}
                    className={"block py-2.5 px-2 -mx-2 transition-colors " + (active ? "bg-amber-500/5" : "hover:bg-ink-800/40")}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={"font-mono text-2xs uppercase tracking-widest " + (active ? "text-amber-400" : "text-ink-400")}>
                        {c.case_number}
                      </span>
                      <Pill tone={
                        c.assessment_state === "approved" || c.assessment_state === "conditionally_approved" ? "go" :
                        c.assessment_state === "rejected" ? "stop" :
                        c.assessment_state === "escalated_to_human" ? "stop" :
                        c.assessment_state === "needs_info" ? "ping" : "neutral"
                      }>
                        {c.assessment_state.replace(/_/g, " ")}
                      </Pill>
                    </div>
                    <p className={"font-mono text-2xs mt-0.5 " + (active ? "text-ink-300" : "text-ink-500")}>
                      {c.origin_country} → {c.destination_country}
                    </p>
                  </Link>
                );
              })}
              {(recentCases ?? []).length === 0 && (
                <p className="font-mono text-2xs uppercase tracking-widest text-ink-500 py-8 text-center">
                  No cases — spawn one from /
                </p>
              )}
            </div>
          </Panel>

          <CaseTimeline caseId={targetCaseId} />
        </div>
      </main>
    </>
  );
}
