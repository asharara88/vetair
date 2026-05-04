// Static agent registry — the static side of the MAS roster.
// Synthesized specialists are *not* listed here; they live in the
// synthesized_specialists table and are loaded on demand via buildSpecialist().

import type { AgentDefinition } from "./types";
import { ORCHESTRATOR } from "./orchestrator";
import { INTAKE } from "./intake";
import { DOCUMENT } from "./document";
import { COMPLIANCE } from "./compliance";
import { AUDITOR } from "./auditor";
import { VET_NETWORK } from "./vet_network";
import { AIRLINE_CRATE } from "./airline_crate";
import { ENDORSEMENT } from "./endorsement";
import { COMMS } from "./comms";
import { AUDIT } from "./audit";
import { SYNTHESIZER } from "./synthesizer";

export {
  ORCHESTRATOR,
  INTAKE,
  DOCUMENT,
  COMPLIANCE,
  AUDITOR,
  VET_NETWORK,
  AIRLINE_CRATE,
  ENDORSEMENT,
  COMMS,
  AUDIT,
  SYNTHESIZER,
};
export { SPECIALIST_TEMPLATE, buildSpecialist, type SpecialistParams } from "./specialist";
export type { AgentDefinition, AgentTool, AgentBudget, ModelId } from "./types";
export {
  AGENT_TYPE_BLURB,
  AGENT_TYPE_ORDER,
  AGENT_TYPE_TONE,
  agentTypeBlurb,
  agentTypeOrder,
  agentTypeTone,
  compareAgentRows,
  type AgentRegistryRow,
  type AgentType,
  type AgentTypeTone,
} from "./registry-meta";
export {
  ACKNOWLEDGE_AND_WAIT_TOOL,
  ASK_USER_FOR_INPUT_TOOL,
  CASE_ID_INPUT,
  DOCUMENT_KINDS,
  requestDocumentTool,
  type DocumentKind,
} from "./shared-tools";

export const STATIC_AGENTS: readonly AgentDefinition[] = [
  ORCHESTRATOR,
  INTAKE,
  DOCUMENT,
  COMPLIANCE,
  AUDITOR,
  VET_NETWORK,
  AIRLINE_CRATE,
  ENDORSEMENT,
  COMMS,
  AUDIT,
  SYNTHESIZER,
] as const;

const BY_NAME: Record<string, AgentDefinition> = Object.fromEntries(
  STATIC_AGENTS.map((a) => [a.name, a]),
);

export const STATIC_AGENTS_BY_NAME: Readonly<Record<string, AgentDefinition>> =
  Object.freeze(BY_NAME);

/**
 * Resolve an agent definition by `agent_runs.agent_name`.
 *
 * Returns `null` for synthesized specialists (whose names follow the
 * `{cc}_compliance_specialist` pattern) — those must be loaded from the
 * `synthesized_specialists` row and reconstructed via `buildSpecialist`.
 */
export function resolveStaticAgent(name: string): AgentDefinition | null {
  return STATIC_AGENTS_BY_NAME[name] ?? null;
}
