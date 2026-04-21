"use client";
import type { ConsensusRound } from "@/types/database";
import { Panel, Pill } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

interface TimelineEntry { date: string; event: string }

export function ConsensusTimeline({ rounds }: { rounds: ConsensusRound[] }) {
  const timelineRound = rounds.find((r) => r.topic === "timeline_feasibility");
  const verdict = timelineRound?.final_verdict as { plan?: TimelineEntry[]; total_duration_days?: number } | null | undefined;
  const plan: TimelineEntry[] = verdict?.plan ?? [];
  const totalDuration = typeof verdict?.total_duration_days === "number" ? verdict.total_duration_days : null;

  return (
    <Panel eyebrow="05 · Consensus Timeline" title="Plan">
      {plan.length === 0 ? (
        <p className="font-mono text-2xs uppercase tracking-widest text-ink-500 py-6 text-center">
          Timeline pending consensus
        </p>
      ) : (
        <div className="relative">
          {/* Vertical rail */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-ink-700" aria-hidden="true" />

          <div className="space-y-4">
            {plan.map((entry, i) => {
              const isLast = i === plan.length - 1;
              return (
                <div key={i} className="flex items-start gap-4 relative">
                  <div className="relative flex-shrink-0 w-4 pt-1">
                    <div className={`w-[15px] h-[15px] border-2 ${isLast ? "bg-amber-500 border-amber-500" : "bg-ink-900 border-ink-500"}`} />
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-2xs uppercase tracking-widest text-amber-400 tabular-nums">
                        {formatDate(entry.date)}
                      </span>
                      {isLast && <Pill tone="amber">Final step</Pill>}
                    </div>
                    <p className="text-sm text-ink-200 mt-1">{entry.event}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {totalDuration !== null && (
            <p className="font-mono text-2xs uppercase tracking-widest text-ink-500 mt-4 pt-4 border-t border-ink-700/60">
              Total duration: {totalDuration} days
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
