import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------- date / time ----------

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function durationBetween(start: string, end: string | null): string {
  const s = Math.floor((new Date(end ?? Date.now()).getTime() - new Date(start).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ---------- numbers ----------

export function formatCost(usd: number | string | null | undefined): string {
  if (usd == null) return "—";
  const n = Number(usd);
  if (n < 0.001) return `$${n.toFixed(5)}`;
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(3)}`;
}

export function formatTokens(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v < 1000) return String(v);
  return `${(v / 1000).toFixed(1)}k`;
}

// ---------- models ----------

// Compact display family for any Anthropic model id (claude-sonnet-4-5 → "Sonnet").
export function modelFamily(model: string | null | undefined): string {
  if (!model) return "—";
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  return model;
}

// ---------- terminal tools ----------
// Pill tone for `agent_runs.terminal_tool` and equivalent fields.

export type SignalTone = "go" | "hold" | "stop" | "ping" | "amber" | "neutral";

export const TERMINAL_TONE: Record<string, SignalTone> = {
  emit_assessment: "go",
  handoff_to_compliance: "go",
  dispatch_to_agent: "amber",
  ask_user_for_input: "ping",
  close_case: "go",
  concur: "go",
  dissent: "stop",
  escalate_to_human: "stop",
  register_specialist: "go",
  send_reply: "neutral",
  send_outbound: "neutral",
  request_document: "neutral",
  acknowledge_and_wait: "neutral",
  emit_extraction: "go",
  fail_synthesis: "stop",
  fail_extraction: "stop",
  // vet_network, airline_crate, endorsement, audit
  book_appointment: "go",
  book_flight: "go",
  submit_endorsement: "go",
  no_match: "stop",
  embargo_block: "stop",
  window_violation: "stop",
  pause_case: "stop",
  all_clear: "go",
};

// Map an agent_runs row's (state, terminal_tool) to a pill tone + display label.
// Centralizes the LiveReceipts / CaseTimeline branching that was duplicated.
export function runRowSignal(
  state: string,
  terminalTool: string | null,
): { tone: SignalTone; label: string } {
  if (state === "complete") {
    const tool = terminalTool ?? "done";
    return { tone: TERMINAL_TONE[tool] ?? "neutral", label: tool };
  }
  if (state === "running") return { tone: "amber", label: "running…" };
  return { tone: "stop", label: state.replace(/_/g, " ") };
}

// ---------- verdicts & states ----------
// Pill tone for compliance verdicts (assessments + audits + synth runs).

export function verdictTone(verdict: string | null | undefined): SignalTone {
  switch (verdict) {
    case "approved":
    case "concur":
    case "satisfied":
      return "go";
    case "blocked":
    case "rejected":
    case "dissent":
    case "escalated_to_human":
    case "fail_synthesis":
      return "stop";
    case "pending":
    case "needs_info":
      return "ping";
    case "conditionally_approved":
      return "go";
    default:
      return "neutral";
  }
}

// Pill tone for `cases.assessment_state` (a superset of verdicts with case-level states).
export function assessmentStateTone(state: string | null | undefined): SignalTone {
  if (!state) return "neutral";
  return verdictTone(state);
}

// ---------- agent display metadata ----------
// Covers BOTH the new MAS agent_registry agents (intake, compliance, auditor,
// orchestrator, synthesizer, *_compliance_specialist) AND the legacy demo
// agent_logs names still emitted by the dramatized demo-stream pipeline.

export const AGENT_META: Record<string, { label: string; color: string; short: string }> = {
  // New MAS roster
  orchestrator:        { label: "Case Coordinator",     color: "#fbbe4c", short: "ORC" },
  intake:              { label: "Intake Team",          color: "#60a5fa", short: "INT" },
  document:            { label: "Document Team",        color: "#60a5fa", short: "DOC" },
  compliance:          { label: "Compliance Team",      color: "#34d399", short: "CMP" },
  auditor:             { label: "Senior Auditor",       color: "#f87171", short: "AUD" },
  vet_network:         { label: "Vet Network",          color: "#60a5fa", short: "VET" },
  airline_crate:       { label: "Airline & Crate",      color: "#60a5fa", short: "AIR" },
  endorsement:         { label: "Endorsement",          color: "#60a5fa", short: "END" },
  comms:               { label: "Comms Team",           color: "#fbbe4c", short: "CMS" },
  synthesizer:         { label: "Specialist Factory",   color: "#fbbe4c", short: "SYN" },
  audit:               { label: "Audit Watchdog",       color: "#8b95a6", short: "AUD" },

  // Legacy / dramatized demo names
  intake_agent:        { label: "Intake Agent",         color: "#60a5fa", short: "INT" },
  document_agent:      { label: "Document Agent",       color: "#60a5fa", short: "DOC" },
  compliance_agent:    { label: "Compliance (Primary)", color: "#34d399", short: "C-1" },
  compliance_primary:  { label: "Compliance (Primary)", color: "#34d399", short: "C-1" },
  deterministic_engine:{ label: "Deterministic Engine", color: "#c5ccd6", short: "DET" },
  compliance_auditor:  { label: "Compliance (Auditor)", color: "#f87171", short: "C-2" },
  vet_network_agent:   { label: "Vet Network",          color: "#60a5fa", short: "VET" },
  airline_crate_agent: { label: "Airline & Crate",      color: "#60a5fa", short: "AIR" },
  endorsement_agent:   { label: "Endorsement",          color: "#60a5fa", short: "END" },
  comms_agent:         { label: "Comms",                color: "#fbbe4c", short: "CMS" },
  audit_agent:         { label: "Audit",                color: "#8b95a6", short: "AUD" },
};

export function agentMeta(name: string) {
  if (AGENT_META[name]) return AGENT_META[name];
  // Synthesized specialists arrive as e.g. "jp_compliance_specialist".
  if (name.endsWith("_compliance_specialist")) {
    const cc = name.slice(0, 2).toUpperCase();
    return { label: `${cc} Specialist`, color: "#fbbe4c", short: cc };
  }
  return { label: name, color: "#8b95a6", short: name.slice(0, 3).toUpperCase() };
}
