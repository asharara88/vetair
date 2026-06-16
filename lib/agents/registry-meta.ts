// Shared metadata for `agent_registry.agent_type`.
// Owns the type union, dispatch order, and UI tone. Blurbs are derived from
// AgentDefinition.description in lib/agents/index.ts — single source of truth.

export type AgentType =
  | "orchestrator"
  | "intake"
  | "document"
  | "compliance"
  | "auditor"
  | "comms"
  | "synthesizer"
  | "specialist"
  | "logistics"
  | "endorsement";

export type AgentTypeTone = "amber" | "go" | "ping" | "neutral";

export interface AgentRegistryRow {
  agent_name: string;
  agent_type: string;
  model: string;
  status: string;
  user_facing_label: string | null;
  invocation_count: number;
  template_id: string | null;
  synthesis_params: Record<string, unknown> | null;
  created_at?: string;
}

export const AGENT_TYPE_ORDER: Record<AgentType, number> = {
  orchestrator: 0,
  intake: 1,
  document: 2,
  compliance: 3,
  auditor: 4,
  comms: 5,
  synthesizer: 6,
  specialist: 7,
  logistics: 8,
  endorsement: 9,
};

export const AGENT_TYPE_TONE: Record<AgentType, AgentTypeTone> = {
  orchestrator: "amber",
  synthesizer: "amber",
  specialist: "amber",
  auditor: "ping",
  compliance: "go",
  intake: "neutral",
  document: "neutral",
  comms: "neutral",
  logistics: "neutral",
  endorsement: "ping",
};

const FALLBACK_ORDER = 99;

// Safe accessors. Consumers receive `agent_type` as `string` from the DB, so
// these wrap the typed records with a graceful default.

export function agentTypeOrder(type: string): number {
  return AGENT_TYPE_ORDER[type as AgentType] ?? FALLBACK_ORDER;
}

export function agentTypeTone(type: string): AgentTypeTone {
  return AGENT_TYPE_TONE[type as AgentType] ?? "neutral";
}

export function compareAgentRows<T extends { agent_type: string; agent_name: string }>(
  a: T,
  b: T,
): number {
  const ao = agentTypeOrder(a.agent_type);
  const bo = agentTypeOrder(b.agent_type);
  if (ao !== bo) return ao - bo;
  return a.agent_name.localeCompare(b.agent_name);
}
