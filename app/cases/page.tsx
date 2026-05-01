import { Header } from "@/components/demo/Header";
import { Pill } from "@/components/ui/primitives";
import { AutoRefresh } from "@/components/demo/AutoRefresh";
import { serverSupabase } from "@/lib/supabase-server";
import { assessmentStateTone, timeAgo } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: "Live cases · Vetair" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface CaseRow {
  id: string;
  case_number: string;
  origin_country: string;
  destination_country: string;
  assessment_state: string;
  target_date: string | null;
  created_at: string;
  pets: { name: string | null; breed: string | null } | null;
  owners: { full_name: string | null } | null;
}

export default async function CasesIndex({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "all" } = await searchParams;
  const supabase = await serverSupabase();

  let query = supabase
    .from("cases")
    .select(
      "id, case_number, origin_country, destination_country, assessment_state, target_date, created_at, pets(name, breed), owners(full_name)"
    )
    .eq("demo_mode", false)
    .order("created_at", { ascending: false })
    .limit(60);

  if (filter !== "all") {
    query = query.eq("assessment_state", filter);
  }

  const { data: cases } = await query;
  const rows = (cases ?? []) as unknown as CaseRow[];

  // Get counts for filter tabs
  const { data: allRows } = await supabase
    .from("cases")
    .select("assessment_state")
    .eq("demo_mode", false);
  const counts = new Map<string, number>();
  for (const r of allRows ?? []) {
    counts.set((r as { assessment_state: string }).assessment_state,
      (counts.get((r as { assessment_state: string }).assessment_state) ?? 0) + 1);
  }
  const total = (allRows ?? []).length;

  const FILTERS: { id: string; label: string }[] = [
    { id: "all",                 label: "All" },
    { id: "needs_info",          label: "Needs info" },
    { id: "awaiting_compliance", label: "In compliance" },
    { id: "awaiting_audit",      label: "In audit" },
    { id: "approved",            label: "Approved" },
    { id: "rejected",            label: "Rejected" },
    { id: "escalated_to_human",  label: "Escalated" },
  ];

  return (
    <>
      <Header />

      <main className="max-w-[1200px] mx-auto px-6 py-12">
        <section className="mb-8 max-w-3xl">
          <p className="font-mono text-2xs uppercase tracking-widest text-brand-500 mb-3">
            Live cases
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold leading-[1.1] tracking-tight text-ink-100">
            Real pets. Real outcomes.
          </h1>
          <p className="text-lg text-ink-300 mt-4 leading-relaxed">
            Every case here is a real pet, real owner, real route. The state pill
            shows what stage the system is at. Click any case to see the agents
            run turn by turn.
          </p>
          <div className="mt-5">
            <AutoRefresh intervalMs={6000} label="Live · 6s" />
          </div>
        </section>

        {/* Filter tabs */}
        <div className="border-b border-ink-700/60 mb-6 overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              const count = f.id === "all" ? total : (counts.get(f.id) ?? 0);
              return (
                <Link
                  key={f.id}
                  href={f.id === "all" ? "/cases" : `/cases?filter=${f.id}`}
                  className={`px-4 pb-3 -mb-px border-b-2 inline-flex items-center gap-2 text-sm transition-colors ${
                    active
                      ? "border-brand-500 text-ink-100"
                      : "border-transparent text-ink-400 hover:text-ink-100"
                  }`}
                >
                  {f.label}
                  <span className={`font-mono text-2xs ${active ? "text-ink-300" : "text-ink-500"}`}>
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Cases table */}
        <div className="border border-ink-700/60">
          {/* Header row */}
          <div className="hidden md:grid grid-cols-[180px_80px_1fr_1fr_140px_80px] gap-4 px-5 py-3 bg-ink-900/40 border-b border-ink-700/60 font-mono text-2xs uppercase tracking-widest text-ink-500">
            <span>Case</span>
            <span>Route</span>
            <span>Pet</span>
            <span>Owner</span>
            <span>State</span>
            <span className="text-right">Created</span>
          </div>

          {rows.length === 0 ? (
            <div className="px-5 py-12 text-center text-ink-500 font-mono text-2xs uppercase tracking-widest">
              No cases match this filter
            </div>
          ) : (
            <div className="divide-y divide-ink-700/40">
              {rows.map((c) => (
                <Link
                  key={c.id}
                  href={`/cases/${c.id}`}
                  className="block px-5 py-3.5 hover:bg-ink-800/30 transition-colors group"
                >
                  {/* Desktop: grid */}
                  <div className="hidden md:grid grid-cols-[180px_80px_1fr_1fr_140px_80px] gap-4 items-center">
                    <span className="font-mono text-2xs uppercase tracking-widest text-ink-300 truncate group-hover:text-brand-500 transition-colors">
                      {c.case_number}
                    </span>
                    <span className="font-mono text-2xs text-ink-400">
                      {c.origin_country}→{c.destination_country}
                    </span>
                    <span className="text-sm text-ink-100 truncate">
                      {c.pets?.name ?? "—"}
                      {c.pets?.breed && (
                        <span className="text-ink-400"> · {c.pets.breed}</span>
                      )}
                    </span>
                    <span className="text-sm text-ink-300 truncate">
                      {c.owners?.full_name ?? "—"}
                    </span>
                    <Pill tone={assessmentStateTone(c.assessment_state)}>
                      {c.assessment_state.replace(/_/g, " ")}
                    </Pill>
                    <span className="font-mono text-2xs text-ink-500 text-right tabular-nums">
                      {timeAgo(c.created_at)}
                    </span>
                  </div>

                  {/* Mobile: stacked */}
                  <div className="md:hidden flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-2xs uppercase tracking-widest text-ink-300 group-hover:text-brand-500 transition-colors">
                        {c.case_number}
                      </span>
                      <Pill tone={assessmentStateTone(c.assessment_state)}>
                        {c.assessment_state.replace(/_/g, " ")}
                      </Pill>
                    </div>
                    <div className="text-sm text-ink-100">
                      {c.pets?.name ?? "—"}
                      {c.pets?.breed && (
                        <span className="text-ink-400"> · {c.pets.breed}</span>
                      )}
                    </div>
                    <div className="font-mono text-2xs text-ink-500 flex items-center justify-between">
                      <span>{c.origin_country}→{c.destination_country}</span>
                      <span>{timeAgo(c.created_at)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
