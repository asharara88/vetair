// Public barrel for the MAS agent module.
// All agent definitions, the static registry, and the dispatch helpers are
// re-exported here so callers import from a single path: `@/lib/agents`.

export { ORCHESTRATOR } from "./orchestrator";
export { INTAKE } from "./intake";
export { DOCUMENT } from "./document";
export { COMPLIANCE } from "./compliance";
export { AUDITOR } from "./auditor";
export { COMMS } from "./comms";
export { SYNTHESIZER } from "./synthesizer";

export {
  SPECIALIST_TEMPLATE,
  buildSpecialist,
  specialistName,
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

export {
  STATIC_AGENTS,
  STATIC_AGENTS_BY_NAME,
  resolveStaticAgent,
} from "./registry-store";

export {
  isSpecialistName,
  parseSpecialistName,
  resolveAgent,
  terminalToolEffect,
  isTerminalToolOf,
  type TerminalEffect,
} from "./dispatch";
