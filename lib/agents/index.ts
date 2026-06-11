// Static agent registry — the static side of the MAS roster.
// Synthesized specialists are *not* listed here; they live in the
// synthesized_specialists table and are loaded on demand via buildSpecialist().

import type { AgentDefinition } from "./types";
import { ORCHESTRATOR } from "./orchestrator";
import { INTAKE } from "./intake";
import { DOCUMENT } from "./document";
import { COMPLIANCE } from "./compliance";
import { AUDITOR } from "./auditor";
import { COMMS } from "./comms";
import { SYNTHESIZER } from "./synthesizer";
import { AUDIT } from "./audit";
import { STATUS_WATCHDOG } from "./status-watchdog";
import { EXCEPTION_HANDLER } from "./exception-handler";
import { isSpecialistAgentName } from "./specialist";

export {
  ORCHESTRATOR,
  INTAKE,
  DOCUMENT,
  COMPLIANCE,
  AUDITOR,
  COMMS,
  SYNTHESIZER,
  AUDIT,
  STATUS_WATCHDOG,
  EXCEPTION_HANDLER,
};
export {
  SPECIALIST_TEMPLATE,
  buildSpecialist,
  isSpecialistAgentName,
  type SpecialistParams,
} from "./specialist";
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

export const STATIC_AGENTS: readonly AgentDefinition[] = [
  ORCHESTRATOR,
  INTAKE,
  DOCUMENT,
  COMPLIANCE,
  AUDITOR,
  COMMS,
  SYNTHESIZER,
  AUDIT,
  STATUS_WATCHDOG,
  EXCEPTION_HANDLER,
] as const;

export const STATIC_AGENTS_BY_NAME: Readonly<Record<string, AgentDefinition>> = Object.freeze(
  Object.fromEntries(STATIC_AGENTS.map((a) => [a.name, a])),
);

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

/**
 * Classify an agent name without resolving it. Useful for routing decisions
 * (e.g. should the orchestrator hydrate a specialist from the DB?).
 */
export function classifyAgentName(name: string): "static" | "specialist" | "unknown" {
  if (name in STATIC_AGENTS_BY_NAME) return "static";
  if (isSpecialistAgentName(name)) return "specialist";
  return "unknown";
}
