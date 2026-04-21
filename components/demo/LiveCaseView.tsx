"use client";
import { useEffect, useState } from "react";
import type {
  AgentLog, Case, CommsMessage, ConsensusRound, Owner, Pet,
} from "@/types/database";
import { browserSupabase } from "@/lib/supabase";
import { AgentChatter } from "./AgentChatter";
import { ThreeVoicePanel } from "./ThreeVoicePanel";
import { WhatsAppPanel } from "./WhatsAppPanel";
import { ConsensusTimeline } from "./ConsensusTimeline";
import { CaseStateMachine } from "./CaseStateMachine";
import { RequirementMatrix } from "./RequirementMatrix";
import { Panel, Pill } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

interface Requirement { id: string; requirement_code: string; title: string; requirement_type: string; priority: number; source_url: string | null }
interface Evaluation { country_rule_id: string; status: "satisfied" | "pending" | "blocked" | "not_applicable"; notes: string | null; evaluator: string; earliest_legal_date: string | null; blocking_reason: string | null }

export function LiveCaseView({
  initialCase, owner, pet, streamScript,
  initialLogs, initialMessages, initialRounds,
  requirements, initialEvaluations,
}: {
  initialCase: Case;
  owner: Owner;
  pet: Pet;
  streamScript?: string;
  initialLogs: AgentLog[];
  initialMessages: CommsMessage[];
  initialRounds: ConsensusRound[];
  requirements: Requirement[];
  initialEvaluations: Evaluation[];
}) {
  const [caseRow, setCaseRow] = useState<Case>(initialCase);
  const [logs, setLogs] = useState<AgentLog[]>(initialLogs);
  const [messages, setMessages] = useState<CommsMessage[]>(initialMessages);
  const [rounds, setRounds] = useState<ConsensusRound[]>(initialRounds);
  const [evaluations, setEvaluations] = useState<Evaluation[]>(initialEvaluations);
  const [streamStatus, setStreamStatus] = useState<"idle" | "running" | "complete" | "error">(
    streamScript ? "running" : "idle",
  );
  const [currentStep, setCurrentStep] = useState<{ total: number; at: number } | null>(null);

  // Track progress via log count (approximation but pitch-adequate)
  useEffect(() => {
    if (!streamScript) return;
    // Heuristic: total steps ~= what we expect for this script. We only need a ballpark.
    const knownTotals: Record<string, number> = {
      sarah_max_uae_uk_v1: 20,
      james_luna_uae_uk_happy_path_v1: 20,
    };
    const total = knownTotals[streamScript] ?? 20;
    setCurrentStep({ total, at: Math.min(logs.length + messages.length, total) });
    if (caseRow.state === "approved" || caseRow.state === "closed" || caseRow.state === "blocked") {
      setStreamStatus("complete");
    }
  }, [streamScript, logs.length, messages.length, caseRow.state]);

  // Subscribe to Supabase realtime for this case — works in both modes
  useEffect(() => {
    const supabase = browserSupabase();
    const channel = supabase
      .channel(`case-${caseRow.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "agent_logs", filter: `case_id=eq.${caseRow.id}` }, (payload) => {
        setLogs((prev) => [...prev, payload.new as AgentLog]);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comms_messages", filter: `case_id=eq.${caseRow.id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as CommsMessage]);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "consensus_rounds", filter: `case_id=eq.${caseRow.id}` }, (payload) => {
        setRounds((prev) => [...prev, payload.new as ConsensusRound]);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "requirement_evaluations", filter: `case_id=eq.${caseRow.id}` }, (payload) => {
        setEvaluations((prev) => [...prev, payload.new as Evaluation]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cases", filter: `id=eq.${caseRow.id}` }, (payload) => {
        setCaseRow(payload.new as Case);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [caseRow.id]);

  const complianceConsensus = rounds.find((r) => r.topic === "compliance_verdict") ?? null;

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">
      {/* Case header */}
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="font-mono text-2xs uppercase tracking-widest text-ink-400">
              {caseRow.case_number}
            </span>
            {caseRow.demo_mode && <Pill tone="amber">Dramatized</Pill>}
            {streamStatus === "running" && <Pill tone="ping" dot>Streaming</Pill>}
            {streamStatus === "complete" && <Pill tone="go">Demo complete</Pill>}
            {currentStep && currentStep.total > 0 && (
              <span className="font-mono text-2xs text-ink-500 tabular-nums">
                step {currentStep.at} / {currentStep.total}
              </span>
            )}
          </div>
          <h1 className="font-display text-3xl text-ink-100 tracking-tight">
            {pet.name} · <span className="text-ink-400">{owner.full_name}</span>
          </h1>
          <p className="text-sm text-ink-400 mt-1">
            {caseRow.origin_country} → {caseRow.destination_country}
            {pet.breed && <> · {pet.breed}</>}
            {caseRow.target_date && <> · target {formatDate(caseRow.target_date)}</>}
            {caseRow.earliest_legal_departure && (
              <> · <span className="text-amber-400 font-mono">earliest legal {formatDate(caseRow.earliest_legal_departure)}</span></>
            )}
          </p>
        </div>
      </div>

      <CaseStateMachine current={caseRow.state} />

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <ThreeVoicePanel consensus={complianceConsensus} />
          <ConsensusTimeline rounds={rounds} />
        </div>
        <div className="space-y-5">
          <AgentChatter logs={logs} />
          <WhatsAppPanel messages={messages} />
        </div>
      </div>

      <RequirementMatrix requirements={requirements} evaluations={evaluations} />
    </div>
  );
}
