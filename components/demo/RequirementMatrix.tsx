"use client";
import { Panel, Pill } from "@/components/ui/primitives";

interface Requirement {
  requirement_code: string;
  title: string;
  requirement_type: string;
  priority: number;
  source_url: string | null;
}

interface Evaluation {
  country_rule_id: string;
  status: "satisfied" | "pending" | "blocked" | "not_applicable";
  notes: string | null;
  evaluator: string;
  earliest_legal_date: string | null;
  blocking_reason: string | null;
}

const STATUS_TONE = {
  satisfied: "go" as const,
  pending: "hold" as const,
  blocked: "stop" as const,
  not_applicable: "neutral" as const,
};

const STATUS_LABEL = {
  satisfied: "✓ OK",
  pending: "• wait",
  blocked: "✕ block",
  not_applicable: "— n/a",
};

export function RequirementMatrix({
  requirements,
  evaluations,
}: {
  requirements: (Requirement & { id: string })[];
  evaluations: Evaluation[];
}) {
  if (requirements.length === 0) return null;

  return (
    <Panel eyebrow="06 · Requirement Matrix" title={<span>Rules <span className="text-ink-500 font-mono text-sm">· {requirements.length}</span></span>}>
      <div className="divide-y divide-ink-700/50">
        {requirements
          .slice()
          .sort((a, b) => b.priority - a.priority)
          .map((req) => {
            const evals = evaluations.filter((e) => e.country_rule_id === req.id);
            const primaryEval = evals[0];
            const status = primaryEval?.status ?? "pending";
            return (
              <div key={req.id} className="py-3 flex items-start gap-4">
                <div className="flex-shrink-0 pt-0.5">
                  <Pill tone={STATUS_TONE[status]} dot={status === "blocked" || status === "satisfied"}>
                    {STATUS_LABEL[status]}
                  </Pill>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="font-mono text-2xs text-amber-400">{req.requirement_code}</span>
                    <span className="font-mono text-2xs uppercase tracking-widest text-ink-500">
                      {req.requirement_type}
                    </span>
                    {req.priority >= 95 && <Pill tone="stop">Hard blocker</Pill>}
                  </div>
                  <p className="text-sm text-ink-200 mt-1">{req.title}</p>
                  {primaryEval?.notes && (
                    <p className="text-xs text-ink-400 mt-1 leading-relaxed">{primaryEval.notes}</p>
                  )}
                  {primaryEval?.earliest_legal_date && (
                    <p className="font-mono text-2xs text-amber-400 mt-1 tabular-nums">
                      ↳ earliest legal: {primaryEval.earliest_legal_date}
                    </p>
                  )}
                  {req.source_url && (
                    <a
                      href={req.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-2xs text-ink-500 hover:text-ink-300 mt-1 inline-block underline-offset-2 hover:underline"
                    >
                      cite source ↗
                    </a>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </Panel>
  );
}
