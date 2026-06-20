// Shared metadata for `agent_registry.agent_type`.
// Single source of truth — referenced from the AgentRegistry panel on the
// home page and the Architecture page roster.

export type AgentType =
  | "orchestrator"
  | "intake"
  | "document"
  | "compliance"
  | "auditor"
  | "vet_network"
  | "airline_crate"
  | "endorsement"
  | "comms"
  | "audit"
  | "synthesizer"
  | "specialist";

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
  vet_network: 5,
  airline_crate: 6,
  endorsement: 7,
  comms: 8,
  audit: 9,
  synthesizer: 10,
  specialist: 11,
};

export const AGENT_TYPE_TONE: Record<AgentType, AgentTypeTone> = {
  orchestrator: "amber",
  synthesizer: "amber",
  specialist: "amber",
  auditor: "ping",
  audit: "ping",
  compliance: "go",
  intake: "neutral",
  document: "neutral",
  vet_network: "neutral",
  airline_crate: "neutral",
  endorsement: "neutral",
  comms: "neutral",
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
  vet_network:
    "Books pre-flight procedures (microchip, rabies, titer, endorsement) at approved partner clinics. Honors country-rule timing windows.",
  airline_crate:
    "Picks a carrier + route and sizes the IATA-LAR CR-82 crate. Honors temperature embargoes, snub-nose breed restrictions, and age limits.",
  endorsement:
    "Manages the 7–10 day pre-flight endorsement window. Submits the export health certificate to MOCCAE / APHIS / DEFRA, polls until endorsed.",
  comms:
    "Outbound owner communication. Citation-enforced WhatsApp + email; never invents requirements, always grounds in cited rules.",
  audit:
    "Read-only watchdog. Verifies citation coverage, deterministic agreement, document confidence, and SLA pacing after every loop.",
  synthesizer:
    "Self-extension. Compiles a parameterized template into a runtime specialist when a case opens for an uncovered country.",
  specialist:
    "Synthesized at runtime by the Synthesizer. Country-scoped compliance variant that inherits the compliance loop with a jurisdiction-specific prompt.",
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
