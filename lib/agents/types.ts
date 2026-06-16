// Shared types for the MAS agent definitions.
// One AgentDefinition per file under lib/agents/<name>.ts. The registry
// in lib/agents/index.ts aggregates them so the orchestrator, edge
// functions, and the Next.js API can resolve "what does this agent do".

import type { AgentType } from "./registry-meta";

// Anthropic tool manifest entry — kept loose to avoid pinning to a specific
// SDK version. The shape matches the messages API tool definition.
export interface AgentTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

// Model handles match Anthropic's published model ids exactly.
// We pin the *family*; the dispatcher resolves the active alias at call time.
export type ModelId =
  | "claude-opus-4-7"
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5";

export interface AgentBudget {
  max_turns: number;
  max_input_tokens: number;
  max_dissent_rounds?: number;
}

export interface AgentDefinition {
  /** Stable handle used in agent_registry.agent_name and agent_runs.agent_name. */
  name: string;
  /** Coarse role category — drives UI tone + dispatch routing. */
  type: AgentType;
  /** Default model. Synthesized specialists may override at runtime. */
  model: ModelId;
  /** Pretty label shown in the UI (Architecture page, AgentRegistry panel). */
  user_facing_label: string;
  /** Short description for the registry / debug surfaces. */
  description: string;
  /** Path (relative to repo root) of the markdown prompt. */
  prompt_path: string;
  /** Tools the loop may call. */
  tools: AgentTool[];
  /** Subset of tool names that *end* the loop when invoked. */
  terminal_tools: string[];
  /** Hard budget; orchestrator escalates to human on exhaustion. */
  budget: AgentBudget;
}

// Convenience: assert at module load that terminal_tools ⊆ tools.
export function validateAgent(def: AgentDefinition): AgentDefinition {
  const toolNames = new Set(def.tools.map((t) => t.name));
  const missing = def.terminal_tools.filter((t) => !toolNames.has(t));
  if (missing.length > 0) {
    throw new Error(
      `Agent "${def.name}" lists terminal tools not present in tools[]: ${missing.join(", ")}`,
    );
  }
  return def;
}

// Reused across operational agents (vet_network, airline_crate, endorsement,
// audit) that need to inspect the case row before proposing or booking.
export const READ_CASE_TOOL: AgentTool = {
  name: "read_case",
  description: "Read the case row by id, including state, corridor, target_date, and earliest_legal_departure.",
  input_schema: {
    type: "object",
    properties: { case_id: { type: "string" } },
    required: ["case_id"],
  },
};

// Date window proposals shared by the consensus timeline loop (AGENT.md §2.2).
// vet_network, airline_crate, and endorsement each propose dates against this
// shape; the orchestrator runs the consensus round over the proposals.
export const DATE_WINDOW_PROPERTIES = {
  earliest_date: { type: "string", description: "ISO YYYY-MM-DD, inclusive." },
  latest_date: { type: "string", description: "ISO YYYY-MM-DD, inclusive." },
  preferred_date: { type: "string", description: "ISO YYYY-MM-DD, the agent's first pick." },
} as const;
