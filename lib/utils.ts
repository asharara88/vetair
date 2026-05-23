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
  // Compliance family
  emit_assessment: "go",
  concur: "go",
  dissent: "stop",
  // Orchestrator
  dispatch_to_agent: "amber",
  close_case: "go",
  escalate_to_human: "stop",
  acknowledge_and_wait: "neutral",
  // Intake
  handoff_to_compliance: "go",
  ask_user_for_input: "ping",
  send_reply: "neutral",
  // Comms
  send_outbound: "neutral",
  request_document: "neutral",
  // Document
  emit_extraction: "go",
  fail_extraction: "stop",
  // Synthesizer
  register_specialist: "go",
  fail_synthesis: "stop",
  // Vet Network
  book_appointment: "go",
  no_match_found: "stop",
  // Airline & Crate
  lock_routing: "go",
  embargo_blocked: "stop",
  // Endorsement
  submit_endorsement: "go",
  window_infeasible: "stop",
  // Audit
  post_finding: "ping",
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
// Covers the MAS agent_registry agents (canonical names) plus the legacy
// dramatized demo names still emitted by the demo-stream pipeline.

interface AgentDisplay { label: string; color: string; short: string }

const COLOR = {
  amber: "#fbbe4c",
  blue:  "#60a5fa",
  green: "#34d399",
  red:   "#f87171",
  grey:  "#c5ccd6",
  slate: "#8b95a6",
} as const;

export const AGENT_META: Record<string, AgentDisplay> = {
  // Canonical MAS roster (agent_registry.agent_name)
  orchestrator:   { label: "Case Coordinator",   color: COLOR.amber, short: "ORC" },
  intake:         { label: "Intake Team",        color: COLOR.blue,  short: "INT" },
  document:       { label: "Document Team",      color: COLOR.blue,  short: "DOC" },
  compliance:     { label: "Compliance Team",    color: COLOR.green, short: "CMP" },
  auditor:        { label: "Senior Auditor",     color: COLOR.red,   short: "AUD" },
  vet_network:    { label: "Vet Network Team",   color: COLOR.blue,  short: "VET" },
  airline_crate:  { label: "Airline Cargo Team", color: COLOR.blue,  short: "AIR" },
  endorsement:    { label: "Government Liaison", color: COLOR.blue,  short: "END" },
  comms:          { label: "Comms Team",         color: COLOR.amber, short: "CMS" },
  audit:          { label: "Audit Watchdog",     color: COLOR.slate, short: "WDG" },
  synthesizer:    { label: "Specialist Factory", color: COLOR.amber, short: "SYN" },

  // Legacy / dramatized demo names
  intake_agent:        { label: "Intake Agent",         color: COLOR.blue,  short: "INT" },
  document_agent:      { label: "Document Agent",       color: COLOR.blue,  short: "DOC" },
  compliance_agent:    { label: "Compliance (Primary)", color: COLOR.green, short: "C-1" },
  compliance_primary:  { label: "Compliance (Primary)", color: COLOR.green, short: "C-1" },
  deterministic_engine:{ label: "Deterministic Engine", color: COLOR.grey,  short: "DET" },
  compliance_auditor:  { label: "Compliance (Auditor)", color: COLOR.red,   short: "C-2" },
  vet_network_agent:   { label: "Vet Network",          color: COLOR.blue,  short: "VET" },
  airline_crate_agent: { label: "Airline & Crate",      color: COLOR.blue,  short: "AIR" },
  endorsement_agent:   { label: "Endorsement",          color: COLOR.blue,  short: "END" },
  comms_agent:         { label: "Comms",                color: COLOR.amber, short: "CMS" },
  audit_agent:         { label: "Audit",                color: COLOR.slate, short: "AUD" },
};

export function agentMeta(name: string): AgentDisplay {
  if (AGENT_META[name]) return AGENT_META[name];
  // Synthesized specialists arrive as e.g. "jp_compliance_specialist".
  if (name.endsWith("_compliance_specialist")) {
    const cc = name.slice(0, 2).toUpperCase();
    return { label: `${cc} Specialist`, color: COLOR.amber, short: cc };
  }
  return { label: name, color: COLOR.slate, short: name.slice(0, 3).toUpperCase() };
}
