// Shared metadata for `agent_registry.agent_type`.
// Single source of truth — referenced from the AgentRegistry panel on the
// home page and the Architecture page roster.

// Mirrors `agent_registry.agent_type` values in the live Supabase schema.
// Keep names in sync — they're used as map keys against rows fetched from DB.
export type AgentType =
  | "orchestrator"
  | "intake"
  | "document"
  | "compliance"
  | "auditor"
  | "comms"
  | "synthesizer"
  | "specialist"
  | "status_watchdog"
  | "exception_handler"
  | "vet_network"
  | "endorsement"
  | "airline_crate"
  | "service_acceptance";

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
  status_watchdog: 8,
  exception_handler: 9,
  vet_network: 10,
  endorsement: 11,
  airline_crate: 12,
  service_acceptance: 13,
};

export const AGENT_TYPE_TONE: Record<AgentType, AgentTypeTone> = {
  orchestrator: "amber",
  synthesizer: "amber",
  specialist: "amber",
  auditor: "ping",
  status_watchdog: "ping",
  exception_handler: "ping",
  compliance: "go",
  intake: "neutral",
  document: "neutral",
  comms: "neutral",
  vet_network: "neutral",
  endorsement: "neutral",
  airline_crate: "neutral",
  service_acceptance: "neutral",
};

export const AGENT_TYPE_BLURB: Record<AgentType, string> = {
  orchestrator:
    "Reads case state from the queue and decides which agent to dispatch next. Enforces the per-case budget (turns, dissent rounds, total tokens).",
  intake:
    "Conversational onboarding via WhatsApp. Captures owner + pet + intent. One question per turn, never multi-prompts.",
  document:
    "Native vision extraction. Reads uploaded rabies certificates, microchip records, permits — emits structured fields with confidence.",
  compliance:
    "Primary compliance voice. Reasons over case data + country rules; emits an assessment with citations and missing requirements.",
  auditor:
    "Adversarial reviewer. Re-reads the compliance assessment with reverse framing and either concurs or dissents with challenges.",
  comms:
    "Outbound owner communication. Citation-enforced WhatsApp + email; never invents requirements, always grounds in cited rules.",
  synthesizer:
    "Self-extension. Compiles a parameterized template into a runtime specialist when a case opens for an uncovered country.",
  specialist:
    "Synthesized at runtime by the Synthesizer. Country-scoped compliance variant that inherits the compliance loop with a jurisdiction-specific prompt.",
  status_watchdog:
    "Portfolio sweep at end of every orchestrator cycle. SQL pre-filter flags stale cases; Sonnet decides per-case whether silence is urgent or expected.",
  exception_handler:
    "On-signal remediation. Reads case state, picks the least-disruptive fix (re-enqueue, plan, reroute, or escalate) and routes it.",
  vet_network:
    "Books pre-flight vet visits and chases lab results. Simulation tier in V1 — concierge operator confirms each booking.",
  endorsement:
    "Coordinates government endorsement of the health certificate. Simulation tier in V1 — concierge handles the courier loop.",
  airline_crate:
    "Sizes the IATA-compliant crate and reserves cargo space. Simulation tier in V1 — concierge negotiates the booking.",
  service_acceptance:
    "Owner-facing terms acknowledgement before the case enters fulfillment. Haiku-tier resolution agent.",
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

export function agentTypeBlurb(type: string): string | undefined {
  return AGENT_TYPE_BLURB[type as AgentType];
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
