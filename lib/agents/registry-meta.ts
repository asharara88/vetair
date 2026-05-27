// Shared metadata for `agent_registry.agent_type`.
// Single source of truth — referenced from the AgentRegistry panel on the
// home page and the Architecture page roster.

export type AgentType =
  | "orchestrator"
  | "intake"
  | "document"
  | "compliance"
  | "auditor"
  | "comms"
  | "synthesizer"
  | "specialist"
  | "vet_network"
  | "airline_crate"
  | "endorsement"
  | "watchdog"
  | "exception_handler";

export type AgentTypeTone = "amber" | "go" | "ping" | "neutral" | "stop";

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

interface AgentTypeMeta {
  /** Display order in the registry roster (lower = first). */
  readonly order: number;
  /** UI accent tone for the type Pill. */
  readonly tone: AgentTypeTone;
  /** One-paragraph description shown on the Architecture page. */
  readonly blurb: string;
}

// The one place agent-type presentation lives. Add a new type here and every
// surface (Architecture page, AgentRegistry panel, sort order) picks it up.
export const AGENT_TYPE_META: Record<AgentType, AgentTypeMeta> = {
  orchestrator: {
    order: 0,
    tone: "amber",
    blurb:
      "Reads case state from the queue and decides which agent to dispatch next. Enforces the per-case budget (turns, dissent rounds, total tokens).",
  },
  intake: {
    order: 1,
    tone: "neutral",
    blurb:
      "Conversational onboarding via WhatsApp. Captures owner + pet + intent. One question per turn, never multi-prompts.",
  },
  document: {
    order: 2,
    tone: "neutral",
    blurb:
      "Native vision extraction. Reads uploaded rabies certificates, microchip records, permits — emits structured fields with confidence.",
  },
  compliance: {
    order: 3,
    tone: "go",
    blurb:
      "Primary compliance voice. Reasons over case data + country rules; emits an assessment with citations and missing requirements.",
  },
  auditor: {
    order: 4,
    tone: "ping",
    blurb:
      "Adversarial reviewer. Re-reads the compliance assessment with reverse framing and either concurs or dissents with challenges.",
  },
  comms: {
    order: 5,
    tone: "neutral",
    blurb:
      "Outbound owner communication. Citation-enforced WhatsApp + email; never invents requirements, always grounds in cited rules.",
  },
  synthesizer: {
    order: 6,
    tone: "amber",
    blurb:
      "Self-extension. Compiles a parameterized template into a runtime specialist when a case opens for an uncovered country.",
  },
  specialist: {
    order: 7,
    tone: "amber",
    blurb:
      "Synthesized at runtime by the Synthesizer. Country-scoped compliance variant that inherits the compliance loop with a jurisdiction-specific prompt.",
  },
  vet_network: {
    order: 8,
    tone: "go",
    blurb:
      "Matches the owner to an approved vet near their residence and books the required procedure — microchip, vaccine, titer, endorsement, or health check.",
  },
  airline_crate: {
    order: 9,
    tone: "go",
    blurb:
      "Picks the route and locks the booking. Applies IATA LAR carriage rules, CR-82 crate sizing, snub-nose restrictions, and temperature embargoes.",
  },
  endorsement: {
    order: 10,
    tone: "go",
    blurb:
      "Owns the endorsement window (7–10 days pre-flight). Schedules the vet endorsement appointment, submits to MOCCAE / APHA / USDA-APHIS, tracks the courier.",
  },
  watchdog: {
    order: 11,
    tone: "ping",
    blurb:
      "Portfolio-level watchdog. Sweeps non-terminal cases, decides per case whether silence is urgent given the travel date, and dispatches an exception handler or notifies an operator.",
  },
  exception_handler: {
    order: 12,
    tone: "stop",
    blurb:
      "Computes a remediation path for a case-level exception. Picks the least-disruptive fix — re-evaluate, reroute, escalate, or hand back a concrete plan for the human operator.",
  },
};

const FALLBACK_ORDER = 99;

// Safe accessors. Consumers receive `agent_type` as `string` from the DB, so
// these wrap the typed records with a graceful default.

export function agentTypeOrder(type: string): number {
  return AGENT_TYPE_META[type as AgentType]?.order ?? FALLBACK_ORDER;
}

export function agentTypeTone(type: string): AgentTypeTone {
  return AGENT_TYPE_META[type as AgentType]?.tone ?? "neutral";
}

export function agentTypeBlurb(type: string): string | undefined {
  return AGENT_TYPE_META[type as AgentType]?.blurb;
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
