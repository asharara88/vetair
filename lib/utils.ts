import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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

export function formatCost(usd: number | null | undefined): string {
  if (usd == null) return "—";
  if (usd === 0) return "$0";
  if (usd < 0.01) return `${(usd * 100).toFixed(2)}¢`;
  return `$${usd.toFixed(4)}`;
}

interface AgentMeta { label: string; color: string; short: string }

// Agent → display name + signal color. Aliases map alternate names to canonical entries.
const AGENT_META_CANONICAL: Record<string, AgentMeta> = {
  orchestrator:         { label: "Orchestrator",         color: "#fbbe4c", short: "ORC" },
  intake_agent:         { label: "Intake Agent",         color: "#60a5fa", short: "INT" },
  document_agent:       { label: "Document Agent",       color: "#60a5fa", short: "DOC" },
  compliance_primary:   { label: "Compliance (Primary)", color: "#34d399", short: "C-1" },
  deterministic_engine: { label: "Deterministic Engine", color: "#c5ccd6", short: "DET" },
  compliance_auditor:   { label: "Compliance (Auditor)", color: "#f87171", short: "C-2" },
  vet_network_agent:    { label: "Vet Network",          color: "#60a5fa", short: "VET" },
  airline_crate_agent:  { label: "Airline & Crate",      color: "#60a5fa", short: "AIR" },
  endorsement_agent:    { label: "Endorsement",          color: "#60a5fa", short: "END" },
  comms_agent:          { label: "Comms",                color: "#fbbe4c", short: "CMS" },
  audit_agent:          { label: "Audit",                color: "#8b95a6", short: "AUD" },
};

const AGENT_ALIASES: Record<string, string> = {
  compliance_agent: "compliance_primary",
};

export const AGENT_META: Record<string, AgentMeta> = new Proxy(AGENT_META_CANONICAL, {
  get(target, key: string) {
    return target[AGENT_ALIASES[key] ?? key];
  },
});

export function agentMeta(name: string): AgentMeta {
  const canonical = AGENT_ALIASES[name] ?? name;
  return (
    AGENT_META_CANONICAL[canonical] ?? {
      label: name,
      color: "#8b95a6",
      short: name.slice(0, 3).toUpperCase(),
    }
  );
}
