// Static agent registry — the static side of the MAS roster.
// Synthesized specialists are *not* listed here; they live in the
// synthesized_specialists table and are loaded on demand via buildSpecialist().

import type { AgentDefinition } from "./types";
import { ORCHESTRATOR } from "./orchestrator";
import { INTAKE } from "./intake";
import { COMPLIANCE } from "./compliance";
import { AUDITOR } from "./auditor";
import { SYNTHESIZER } from "./synthesizer";

export { ORCHESTRATOR, INTAKE, COMPLIANCE, AUDITOR, SYNTHESIZER };
export { SPECIALIST_TEMPLATE, buildSpecialist, type SpecialistParams } from "./specialist";
export type { AgentDefinition, AgentTool, AgentBudget, ModelId } from "./types";
export {
  AGENT_TYPE_BLURB,
  AGENT_TYPE_ORDER,
  AGENT_TYPE_TONE,
  compareAgentRows,
  type AgentRegistryRow,
  type AgentType,
  type AgentTypeTone,
} from "./registry-meta";

export const STATIC_AGENTS: readonly AgentDefinition[] = [
  ORCHESTRATOR,
  INTAKE,
  COMPLIANCE,
  AUDITOR,
  SYNTHESIZER,
] as const;

export const STATIC_AGENTS_BY_NAME: Readonly<Record<string, AgentDefinition>> =
  Object.freeze(Object.fromEntries(STATIC_AGENTS.map((a) => [a.name, a])));

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
