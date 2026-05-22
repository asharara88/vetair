// SDK-agnostic tool-use loop runner.
//
// The runner doesn't talk to Anthropic directly — it talks to an `AgentInvoker`
// that returns a structured turn. This keeps the loop pure and testable: pass
// a fake invoker in tests, pass a real Messages-API-backed one in production.
//
// Responsibilities:
//   - Maintain the user/assistant message transcript across turns.
//   - Track budget (turns, tokens, dissent rounds) via BudgetTracker.
//   - Dispatch every tool_use block to its registered handler.
//   - Terminate when the model calls a tool listed in `terminal_tools`.
//
// Not in scope here (handled by callers):
//   - Database writes for `agent_runs` / `agent_turns`.
//   - Prompt rendering (use `renderPrompt`).
//   - The Anthropic SDK call itself (wrap it in an AgentInvoker).

import type { AgentDefinition, AgentTool } from "./types";
import { BudgetTracker, type BudgetExhaustion } from "./budget";

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  tool_use_id: string;
  /** Stringified JSON or plain text — whatever the handler returns is serialised here. */
  content: string;
  is_error?: boolean;
}

export interface InvokerMessage {
  role: "user" | "assistant";
  content: Array<
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
    | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean }
  >;
}

export interface InvokerTurn {
  /** Optional free-text emitted by the model alongside any tool calls. */
  text: string | null;
  tool_calls: ToolCall[];
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";
  input_tokens: number;
  output_tokens: number;
}

export interface AgentInvoker {
  invoke(args: {
    system: string;
    model: string;
    tools: AgentTool[];
    messages: InvokerMessage[];
  }): Promise<InvokerTurn>;
}

export type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>;
export type ToolHandlers = Record<string, ToolHandler>;

export interface RunAgentArgs {
  definition: AgentDefinition;
  /** Fully-rendered system prompt (use `renderPrompt` to substitute context). */
  systemPrompt: string;
  /** Initial user turn — typically a serialized context envelope. */
  initialUserMessage: string;
  invoker: AgentInvoker;
  /** Map of tool name → handler. Must cover every name in `definition.tools`. */
  handlers: ToolHandlers;
  /** Optional override (e.g. dispatcher routes to opus on auditor dissent). */
  modelOverride?: string;
}

export type RunReason =
  | "terminal_tool"
  | "budget_exhausted"
  | "no_tool_calls"
  | "missing_handler"
  | "handler_error"
  | "invoker_error";

export interface RunResult {
  reason: RunReason;
  terminal_tool: string | null;
  terminal_input: Record<string, unknown> | null;
  turn_count: number;
  input_tokens: number;
  output_tokens: number;
  exhaustion?: BudgetExhaustion;
  error?: string;
}

/**
 * Run an agent's tool-use loop until it calls a terminal tool, blows its
 * budget, or errors out. Pure orchestration — every external side-effect
 * lives behind `invoker` (Claude call) or `handlers` (tool executors).
 */
export async function runAgent(args: RunAgentArgs): Promise<RunResult> {
  const { definition, systemPrompt, initialUserMessage, invoker, handlers } = args;

  assertHandlersCoverTools(definition, handlers);

  const budget = new BudgetTracker(definition.budget);
  const terminalSet = new Set(definition.terminal_tools);
  const model = args.modelOverride ?? definition.model;

  const messages: InvokerMessage[] = [
    { role: "user", content: [{ type: "text", text: initialUserMessage }] },
  ];

  while (true) {
    const exhaustion = budget.exhaustion;
    if (exhaustion) {
      return finalize("budget_exhausted", budget, { exhaustion });
    }

    let turn: InvokerTurn;
    try {
      turn = await invoker.invoke({
        system: systemPrompt,
        model,
        tools: definition.tools,
        messages,
      });
    } catch (e) {
      return finalize("invoker_error", budget, { error: stringifyError(e) });
    }

    budget.recordTurn(turn.input_tokens, turn.output_tokens);

    // Reconstruct the assistant message from the turn for the next round.
    const assistantContent: InvokerMessage["content"] = [];
    if (turn.text) assistantContent.push({ type: "text", text: turn.text });
    for (const call of turn.tool_calls) {
      assistantContent.push({
        type: "tool_use",
        id: call.id,
        name: call.name,
        input: call.input,
      });
    }
    messages.push({ role: "assistant", content: assistantContent });

    // A turn that emits prose with no tool call is a contract violation —
    // every agent prompt mandates a terminal tool. Stop the loop.
    if (turn.tool_calls.length === 0) {
      return finalize("no_tool_calls", budget, {});
    }

    // If any tool call is terminal, terminate immediately on the FIRST one.
    // We never let an agent batch a terminal alongside non-terminals.
    const terminalCall = turn.tool_calls.find((c) => terminalSet.has(c.name));
    if (terminalCall) {
      return finalize("terminal_tool", budget, {
        terminal_tool: terminalCall.name,
        terminal_input: terminalCall.input,
      });
    }

    // Otherwise execute every tool call, append the results, and loop.
    const toolResults: ToolResult[] = [];
    for (const call of turn.tool_calls) {
      const handler = handlers[call.name];
      if (!handler) {
        return finalize("missing_handler", budget, {
          error: `No handler registered for tool "${call.name}"`,
        });
      }
      try {
        const output = await handler(call.input);
        toolResults.push({
          tool_use_id: call.id,
          content: serializeToolOutput(output),
        });
      } catch (e) {
        return finalize("handler_error", budget, {
          error: `Tool "${call.name}" failed: ${stringifyError(e)}`,
        });
      }
    }
    messages.push({
      role: "user",
      content: toolResults.map((r) => ({
        type: "tool_result",
        tool_use_id: r.tool_use_id,
        content: r.content,
        is_error: r.is_error,
      })),
    });
  }
}

function finalize(
  reason: RunReason,
  budget: BudgetTracker,
  extras: {
    terminal_tool?: string;
    terminal_input?: Record<string, unknown>;
    exhaustion?: BudgetExhaustion;
    error?: string;
  },
): RunResult {
  const usage = budget.usage;
  return {
    reason,
    terminal_tool: extras.terminal_tool ?? null,
    terminal_input: extras.terminal_input ?? null,
    turn_count: usage.turns,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    ...(extras.exhaustion ? { exhaustion: extras.exhaustion } : {}),
    ...(extras.error ? { error: extras.error } : {}),
  };
}

function assertHandlersCoverTools(def: AgentDefinition, handlers: ToolHandlers): void {
  const nonTerminal = def.tools
    .map((t) => t.name)
    .filter((n) => !def.terminal_tools.includes(n));
  const missing = nonTerminal.filter((n) => !(n in handlers));
  if (missing.length > 0) {
    throw new Error(
      `runAgent: agent "${def.name}" missing handlers for non-terminal tools: ${missing.join(", ")}`,
    );
  }
}

function serializeToolOutput(output: unknown): string {
  if (output == null) return "null";
  if (typeof output === "string") return output;
  return JSON.stringify(output);
}

function stringifyError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
