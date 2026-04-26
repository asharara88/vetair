// Vetair agent package — public surface.
//
// Import from this module rather than the per-agent files to keep callers
// decoupled from the file layout. The runtime is the only entry point that
// actually executes anything.

export { runAgent } from "./runtime";
export { listActiveAgents, ensureRegistered, type RegistryRow } from "./registry";
export { TOOLS, COMMON_READ_TOOLS, POST_MESSAGE_TOOL, UPDATE_CASE_STATE_TOOL } from "./tools";
export type {
  AgentDefinition, AgentRunContext, AgentRunResult,
  AgentModel, TerminalTool, ToolSchema,
} from "./types";

import { orchestrator } from "./orchestrator";
import { intake } from "./intake";
import { compliance } from "./compliance";
import { auditor } from "./auditor";
import { comms } from "./comms";
import { synthesizer } from "./synthesizer";
import type { AgentDefinition } from "./types";

export { orchestrator, intake, compliance, auditor, comms, synthesizer };

// Built-in agents that ship in code (specialists are registered at runtime).
export const BUILTIN_AGENTS: Record<string, AgentDefinition> = {
  orchestrator, intake, compliance, auditor, comms, synthesizer,
};

export function getAgent(name: string): AgentDefinition | null {
  return BUILTIN_AGENTS[name] ?? null;
}
