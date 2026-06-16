// Static agent registry — the static side of the MAS roster.
// Synthesized specialists are *not* listed here; they live in the
// synthesized_specialists table and are loaded on demand via buildSpecialist().

import type { AgentDefinition } from "./types";
import { compareAgentRows, type AgentType } from "./registry-meta";
import { ORCHESTRATOR } from "./orchestrator";
import { INTAKE } from "./intake";
import { DOCUMENT } from "./document";
import { COMPLIANCE } from "./compliance";
import { AUDITOR } from "./auditor";
import { COMMS } from "./comms";
import { SYNTHESIZER } from "./synthesizer";
import { LOGISTICS } from "./logistics";
import { ENDORSEMENT } from "./endorsement";

export {
  ORCHESTRATOR,
  INTAKE,
  DOCUMENT,
  COMPLIANCE,
  AUDITOR,
  COMMS,
  SYNTHESIZER,
  LOGISTICS,
  ENDORSEMENT,
};
export { SPECIALIST_TEMPLATE, buildSpecialist, type SpecialistParams } from "./specialist";
export type { AgentDefinition, AgentTool, AgentBudget, ModelId } from "./types";
export {
  AGENT_TYPE_ORDER,
  AGENT_TYPE_TONE,
  agentTypeOrder,
  agentTypeTone,
  compareAgentRows,
  type AgentRegistryRow,
  type AgentType,
  type AgentTypeTone,
} from "./registry-meta";

// Ordered by AGENT_TYPE_ORDER so consumers iterating get a stable display order
// without re-sorting. Specialists are synthesized so don't appear here.
const RAW_STATIC_AGENTS: readonly AgentDefinition[] = [
  ORCHESTRATOR,
  INTAKE,
  DOCUMENT,
  COMPLIANCE,
  AUDITOR,
  COMMS,
  SYNTHESIZER,
  LOGISTICS,
  ENDORSEMENT,
] as const;

export const STATIC_AGENTS: readonly AgentDefinition[] = [...RAW_STATIC_AGENTS].sort((a, b) =>
  compareAgentRows({ agent_type: a.type, agent_name: a.name }, { agent_type: b.type, agent_name: b.name }),
);

export const STATIC_AGENTS_BY_NAME: Readonly<Record<string, AgentDefinition>> = Object.freeze(
  Object.fromEntries(STATIC_AGENTS.map((a) => [a.name, a])),
);

// Single source of truth for the type-level UI blurb. Derives from each agent's
// description so we never have a stale duplicate in registry-meta.ts.
export const AGENT_TYPE_BLURB: Readonly<Partial<Record<AgentType, string>>> = Object.freeze(
  Object.fromEntries(STATIC_AGENTS.map((a) => [a.type, a.description])) as Partial<
    Record<AgentType, string>
  >,
);

const SPECIALIST_BLURB =
  "Synthesized at runtime by the Synthesizer. Country-scoped compliance variant that inherits the compliance loop with a jurisdiction-specific prompt.";

export function agentTypeBlurb(type: string): string | undefined {
  if (type === "specialist") return SPECIALIST_BLURB;
  return AGENT_TYPE_BLURB[type as AgentType];
}

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
