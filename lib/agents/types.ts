// Shared types for the Vetair Multi-Agent System.
// These describe the runtime contract every agent honours: a tool-use loop
// that ends with a single named "terminal tool" call. The runtime persists
// every turn to agent_runs / agent_turns so the LiveReceipts component can
// render the trail without consulting the agents themselves.

export type AgentModel =
  | "claude-opus-4-7"
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5";

// The full set of terminal tools across all agents. Adding one here is the
// signal that a new flow exists; LiveReceipts renders these with colour
// based on the TERMINAL_TONE table.
export type TerminalTool =
  | "emit_assessment"
  | "handoff_to_compliance"
  | "dispatch_to_agent"
  | "ask_user_for_input"
  | "close_case"
  | "concur"
  | "dissent"
  | "escalate_to_human"
  | "register_specialist"
  | "send_reply"
  | "request_document"
  | "acknowledge_and_wait"
  | "fail_synthesis";

// JSON-schema-ish shape for a tool input. We don't validate at runtime here;
// Anthropic's tool-use validates against its own copy. Use this to author the
// manifest in code with autocomplete.
export interface ToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface AgentDefinition {
  /** Unique handle used everywhere: agent_runs.agent_name, registry, logs. */
  name: string;
  /** Which Claude model to use. */
  model: AgentModel;
  /** Static system prompt. Versioned in git; bump when changed. */
  system: string;
  /** Tool manifest (non-terminal + terminal). */
  tools: ToolSchema[];
  /** Subset of `tools` that end the loop. Every agent must declare ≥1. */
  terminalTools: TerminalTool[];
  /** Hard caps; runtime enforces. */
  budget: {
    maxTurns: number;
    maxInputTokens: number;
    maxOutputTokens: number;
  };
}

export interface AgentRunContext {
  /** Case the agent is acting on (null only for orchestrator boot). */
  caseId: string | null;
  /** Free-form payload to seed the user message. */
  input: Record<string, unknown>;
  /** Optional parent run if this agent was dispatched by another. */
  parentRunId?: string | null;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface TextBlock {
  type: "text";
  text: string;
}

export type AssistantBlock = ToolUseBlock | TextBlock;

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface AgentRunResult {
  runId: string;
  state: "complete" | "failed" | "failed_no_terminal";
  terminalTool: TerminalTool | null;
  terminalInput: Record<string, unknown> | null;
  terminalReason: string | null;
  turnCount: number;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
}

// Cost per million tokens (USD). Source: anthropic.com/pricing — verify on
// model bumps. These figures are used to populate agent_runs.total_cost_usd
// so finance dashboards stay honest without round-trips to billing.
export const MODEL_PRICING: Record<AgentModel, { input: number; output: number }> = {
  "claude-opus-4-7":   { input: 15, output: 75 },
  "claude-sonnet-4-6": { input: 3,  output: 15 },
  "claude-haiku-4-5":  { input: 1,  output: 5  },
};

export function priceTokens(model: AgentModel, inTokens: number, outTokens: number): number {
  const p = MODEL_PRICING[model];
  return (inTokens * p.input + outTokens * p.output) / 1_000_000;
}
