// Default model selection per agent role. Env overrides let you roll a
// specific agent forward to a newer Anthropic snapshot without touching code.
//
// Override pattern: ANTHROPIC_MODEL_<UPPER_AGENT_NAME>=claude-...
// Example: ANTHROPIC_MODEL_COMPLIANCE_AUDITOR=claude-opus-4-7

import "server-only";
import type { AgentName } from "@/types/database";

const DEFAULT_MODELS: Record<AgentName, string> = {
  orchestrator:         "claude-sonnet-4-6",
  intake_agent:         "claude-haiku-4-5",
  document_agent:       "claude-sonnet-4-6",
  compliance_primary:   "claude-sonnet-4-6",
  compliance_auditor:   "claude-opus-4-7",
  deterministic_engine: "ts-v1", // not an LLM; sentinel value for agent_logs
  vet_network_agent:    "claude-haiku-4-5",
  airline_crate_agent:  "claude-sonnet-4-6",
  endorsement_agent:    "claude-sonnet-4-6",
  comms_agent:          "claude-haiku-4-5",
  audit_agent:          "claude-haiku-4-5",
};

export function modelFor(agent: AgentName): string {
  const envKey = `ANTHROPIC_MODEL_${agent.toUpperCase()}`;
  return process.env[envKey] ?? DEFAULT_MODELS[agent];
}
