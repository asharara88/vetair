"use client";
import type { CaseState } from "@/types/database";
import { cn } from "@/lib/utils";

const FLOW: CaseState[] = [
  "intake", "assessment", "approved", "documentation",
  "vet_procedures", "booking", "transit", "arrived", "closed",
];

const LABELS: Record<CaseState, string> = {
  draft: "Draft",
  intake: "Intake",
  assessment: "Assessment",
  approved: "Approved",
  blocked: "Blocked",
  documentation: "Docs",
  vet_procedures: "Vet",
  booking: "Booking",
  transit: "Transit",
  arrived: "Arrived",
  closed: "Closed",
  cancelled: "Cancelled",
};

export function CaseStateMachine({ current }: { current: CaseState }) {
  const currentIdx = FLOW.indexOf(current);
  const blocked = current === "blocked";
  const cancelled = current === "cancelled";

  return (
    <div className="panel p-4">
      <p className="font-mono text-2xs uppercase tracking-widest text-ink-400 mb-3">
        Case state
      </p>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {FLOW.map((s, i) => {
          const reached = currentIdx >= i;
          const isCurrent = currentIdx === i && !blocked && !cancelled;
          return (
            <div key={s} className="flex items-center gap-1 flex-shrink-0">
              <div
                className={cn(
                  "px-2.5 py-1 font-mono text-2xs uppercase tracking-widest border whitespace-nowrap",
                  isCurrent && "bg-amber-500 border-amber-500 text-ink-950 inset-glow",
                  !isCurrent && reached && "bg-ink-800 border-ink-600 text-ink-200",
                  !reached && "bg-ink-950/40 border-ink-800 text-ink-500",
                )}
              >
                {LABELS[s]}
              </div>
              {i < FLOW.length - 1 && (
                <span className={cn("font-mono text-2xs", reached ? "text-ink-400" : "text-ink-700")}>
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>
      {(blocked || cancelled) && (
        <div className="mt-3 px-3 py-2 border border-signal-stop/30 bg-signal-stop/5 font-mono text-2xs uppercase tracking-widest text-signal-stop">
          {blocked ? "⚠ Blocked — awaiting resolution" : "Cancelled"}
        </div>
      )}
    </div>
  );
}
