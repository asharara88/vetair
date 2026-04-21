"use client";
import type { ConsensusRound } from "@/types/database";
import { Panel, Pill } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Verdict = "approved" | "blocked" | "pending" | "unknown";

const VERDICT_TONE: Record<Verdict, { tone: "go" | "stop" | "hold" | "neutral"; label: string }> = {
  approved: { tone: "go",      label: "Approved" },
  blocked:  { tone: "stop",    label: "Blocked" },
  pending:  { tone: "hold",    label: "Pending" },
  unknown:  { tone: "neutral", label: "Awaiting" },
};

function VoiceCard({
  index, role, model, verdict, rationale, framing,
}: {
  index: number;
  role: string;
  model: string;
  verdict: Verdict;
  rationale?: string;
  framing: string;
}) {
  const v = VERDICT_TONE[verdict];
  const active = verdict !== "unknown";
  return (
    <div
      className={cn(
        "border p-4 transition-all duration-500",
        active
          ? "bg-ink-900/60 border-ink-600"
          : "bg-ink-950/30 border-ink-800",
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xs text-ink-500 tabular-nums">0{index}</span>
          <span className="font-mono text-2xs uppercase tracking-widest text-ink-400">{role}</span>
        </div>
        <Pill tone={v.tone} dot={active}>{v.label}</Pill>
      </div>
      <p className="font-mono text-2xs text-ink-500 mb-2">{model}</p>
      <p className="text-xs text-ink-400 italic mb-3 leading-snug">{framing}</p>
      {rationale && (
        <div className="border-t border-ink-700/60 pt-3 mt-3">
          <p className="text-sm text-ink-200 leading-relaxed">{rationale}</p>
        </div>
      )}
    </div>
  );
}

export function ThreeVoicePanel({ consensus }: { consensus: ConsensusRound | null }) {
  const complianceConsensus = consensus?.topic === "compliance_verdict" ? consensus : null;
  const verdict = complianceConsensus?.final_verdict;
  const voices = verdict?.three_voices;

  const det: Verdict = (voices?.deterministic?.verdict as Verdict) ?? "unknown";
  const primary: Verdict = (voices?.primary?.verdict as Verdict) ?? "unknown";
  const auditor: Verdict = (voices?.auditor?.verdict as Verdict) ?? "unknown";
  const finalV: Verdict = (verdict?.verdict as Verdict) ?? "unknown";

  const allAgree = det !== "unknown" && det === primary && primary === auditor;
  const resolution = complianceConsensus?.resolution ?? null;

  return (
    <Panel eyebrow="03 · Three-Voice Compliance Spine" title="Consensus">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <VoiceCard
          index={1}
          role="Deterministic"
          model="typescript · rule engine"
          verdict={det}
          rationale={voices?.deterministic?.rationale}
          framing="No LLM. Evaluates rules algorithmically. Wins on factual disagreement."
        />
        <VoiceCard
          index={2}
          role="Primary"
          model="claude-sonnet-4"
          verdict={primary}
          rationale={voices?.primary?.rationale}
          framing="Reasons over case + rules. Cites requirement_codes. Returns verdict."
        />
        <VoiceCard
          index={3}
          role="Auditor"
          model="claude-opus-4.7"
          verdict={auditor}
          rationale={voices?.auditor?.rationale}
          framing="Reverse-framing: 'find ANY reason this case CANNOT fly.' Adversarial."
        />
      </div>

      {consensus && (
        <div className="mt-5 border border-ink-700/60 bg-ink-900/40 p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xs uppercase tracking-widest text-ink-400">
                Final verdict
              </span>
              <Pill tone={VERDICT_TONE[finalV].tone} dot>
                {VERDICT_TONE[finalV].label}
              </Pill>
              {resolution && (
                <Pill tone={allAgree ? "go" : resolution === "escalated" ? "stop" : "hold"}>
                  {resolution}
                </Pill>
              )}
            </div>
            {verdict?.earliest_legal_departure && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xs uppercase tracking-widest text-ink-500">
                  Earliest legal departure
                </span>
                <span className="font-mono text-sm text-amber-400 tabular-nums">
                  {verdict.earliest_legal_departure}
                </span>
              </div>
            )}
          </div>
          {allAgree && (
            <p className="font-mono text-2xs text-signal-go mt-3 tracking-wide">
              ✓ All three voices agreed. Consensus locked.
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
