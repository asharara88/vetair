// Shared metadata for `agent_registry.agent_type`.
// Single source of truth — referenced from the AgentRegistry panel on the
// home page and the Architecture page roster.

export type AgentType =
  | "orchestrator" | "intake" | "compliance" | "auditor" | "synthesizer" | "specialist";

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

export const AGENT_TYPE_ORDER: Record<string, number> = {
  orchestrator: 0,
  intake: 1,
  compliance: 2,
  auditor: 3,
  synthesizer: 4,
  specialist: 5,
};

export const AGENT_TYPE_TONE: Record<string, AgentTypeTone> = {
  orchestrator: "amber",
  synthesizer: "amber",
  specialist: "amber",
  auditor: "ping",
  compliance: "go",
  intake: "neutral",
};

export const AGENT_TYPE_BLURB: Record<string, string> = {
  orchestrator:
    "Reads case state from the queue and decides which agent to dispatch next. Enforces the per-case budget (turns, dissent rounds, total tokens).",
  intake:
    "Conversational onboarding via WhatsApp. Captures owner + pet + intent. One question per turn, never multi-prompts.",
  compliance:
    "Primary compliance voice. Reasons over case data + country rules; emits an assessment with citations and missing requirements.",
  auditor:
    "Adversarial reviewer. Re-reads the compliance assessment with reverse framing and either concurs or dissents with challenges.",
  synthesizer:
    "Self-extension. Compiles a parameterized template into a runtime specialist when a case opens for an uncovered country.",
  specialist:
    "Synthesized at runtime by the Synthesizer. Country-scoped compliance variant that inherits the compliance loop with a jurisdiction-specific prompt.",
};

export function compareAgentRows<T extends { agent_type: string; agent_name: string }>(
  a: T,
  b: T,
): number {
  const ao = AGENT_TYPE_ORDER[a.agent_type] ?? 99;
  const bo = AGENT_TYPE_ORDER[b.agent_type] ?? 99;
  if (ao !== bo) return ao - bo;
  return a.agent_name.localeCompare(b.agent_name);
}
