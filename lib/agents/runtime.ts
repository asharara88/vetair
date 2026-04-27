// The Vetair agent runtime.
//
// `runAgent(def, ctx)` is the only entry point. It opens an `agent_runs` row,
// drives a Claude tool-use loop until either:
//   - the model emits a tool_use call whose name is in `def.terminalTools`, or
//   - the budget caps trip (turn count, token totals), in which case the run
//     is closed as `failed_no_terminal`.
//
// Every assistant turn is appended to `agent_turns` so LiveReceipts and the
// (forthcoming) Case Theater can replay the trail without invoking the agent.
//
// Side-effects are confined to: DB writes via `serviceSupabase`, Anthropic
// Messages API calls. Pure with respect to Claude's randomness; no other
// external state.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceSupabase } from "@/lib/supabase-server";
import { callClaude, AnthropicError, type ClaudeMessage, type ClaudeResponse } from "./anthropic";
import { TOOLS } from "./tools";
import {
  type AgentDefinition,
  type AgentRunContext,
  type AgentRunResult,
  type AssistantBlock,
  type TerminalTool,
  type ToolResultBlock,
  type ToolUseBlock,
  priceTokens,
} from "./types";

interface OpenRun {
  runId: string;
  inputTokens: number;
  outputTokens: number;
  turnCount: number;
}

export async function runAgent(
  def: AgentDefinition,
  ctx: AgentRunContext,
): Promise<AgentRunResult> {
  const supabase = serviceSupabase();
  const open = await openRun(supabase, def, ctx);

  const messages: ClaudeMessage[] = [
    { role: "user", content: JSON.stringify(ctx.input) },
  ];

  try {
    while (open.turnCount < def.budget.maxTurns) {
      open.turnCount += 1;

      let response: ClaudeResponse;
      try {
        response = await callClaude({
          model: def.model,
          system: def.system,
          tools: def.tools,
          messages,
          max_tokens: def.budget.maxOutputTokens,
        });
      } catch (e) {
        const reason = e instanceof AnthropicError ? e.message : (e as Error).message;
        return await closeRun(supabase, open, def, "failed", null, null, reason);
      }

      open.inputTokens += response.usage.input_tokens;
      open.outputTokens += response.usage.output_tokens;

      await appendTurn(supabase, open.runId, open.turnCount, "assistant", response.content, response);

      // Hand the entire assistant response back into the conversation, then
      // append tool_results for any tool_use blocks. Anthropic requires
      // every tool_use to have a matching tool_result in the next user turn.
      messages.push({ role: "assistant", content: response.content });

      const toolUses = response.content.filter(isToolUse);

      // No tool calls — end_turn. Treat as failure since terminal tools are
      // the only legitimate way to finish.
      if (toolUses.length === 0) {
        return await closeRun(
          supabase, open, def, "failed_no_terminal", null, null,
          `agent ended without calling a terminal tool (stop_reason=${response.stop_reason})`,
        );
      }

      // If any tool_use is terminal, that wins. We still write tool_results
      // for any siblings so the conversation remains valid for replay.
      const terminal = toolUses.find((t) => def.terminalTools.includes(t.name as TerminalTool));
      if (terminal) {
        return await closeRun(
          supabase, open, def, "complete",
          terminal.name as TerminalTool,
          terminal.input,
          (terminal.input.reason as string | undefined) ?? null,
        );
      }

      // Non-terminal tools: invoke each, build tool_results.
      const results: ToolResultBlock[] = [];
      for (const tu of toolUses) {
        const impl = TOOLS[tu.name];
        let content: string;
        let isError = false;
        if (!impl) {
          content = JSON.stringify({ error: `unknown tool ${tu.name}` });
          isError = true;
        } else {
          try {
            const out = await impl(tu.input, { supabase, caseId: ctx.caseId });
            content = typeof out === "string" ? out : JSON.stringify(out);
          } catch (e) {
            content = JSON.stringify({ error: (e as Error).message });
            isError = true;
          }
        }
        results.push({ type: "tool_result", tool_use_id: tu.id, content, is_error: isError });
      }

      await appendTurn(supabase, open.runId, open.turnCount, "tool_results", results, null);

      messages.push({ role: "user", content: results });

      // Token-budget guard.
      if (open.inputTokens + open.outputTokens > def.budget.maxInputTokens) {
        return await closeRun(
          supabase, open, def, "failed_no_terminal", null, null,
          `token budget exceeded (${open.inputTokens + open.outputTokens} > ${def.budget.maxInputTokens})`,
        );
      }
    }

    return await closeRun(
      supabase, open, def, "failed_no_terminal", null, null,
      `turn budget exceeded (${def.budget.maxTurns})`,
    );
  } catch (e) {
    return await closeRun(supabase, open, def, "failed", null, null, (e as Error).message);
  }
}

// ---------- helpers ----------

function isToolUse(b: AssistantBlock): b is ToolUseBlock {
  return b.type === "tool_use";
}

async function openRun(
  supabase: SupabaseClient,
  def: AgentDefinition,
  ctx: AgentRunContext,
): Promise<OpenRun> {
  const { data, error } = await supabase
    .from("agent_runs")
    .insert({
      case_id: ctx.caseId,
      agent_name: def.name,
      model: def.model,
      state: "running",
      parent_run_id: ctx.parentRunId ?? null,
      input_payload: ctx.input,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`agent_runs insert failed: ${error?.message}`);
  return { runId: data.id, inputTokens: 0, outputTokens: 0, turnCount: 0 };
}

async function appendTurn(
  supabase: SupabaseClient,
  runId: string,
  turnNumber: number,
  role: "assistant" | "tool_results",
  content: unknown,
  raw: ClaudeResponse | null,
): Promise<void> {
  await supabase.from("agent_turns").insert({
    run_id: runId,
    turn_number: turnNumber,
    role,
    content,
    input_tokens: raw?.usage.input_tokens ?? null,
    output_tokens: raw?.usage.output_tokens ?? null,
    stop_reason: raw?.stop_reason ?? null,
  });
}

async function closeRun(
  supabase: SupabaseClient,
  open: OpenRun,
  def: AgentDefinition,
  state: "complete" | "failed" | "failed_no_terminal",
  terminalTool: TerminalTool | null,
  terminalInput: Record<string, unknown> | null,
  terminalReason: string | null,
): Promise<AgentRunResult> {
  const totalCostUsd = priceTokens(def.model, open.inputTokens, open.outputTokens);
  await supabase
    .from("agent_runs")
    .update({
      state,
      terminal_tool: terminalTool,
      terminal_reason: terminalReason,
      terminal_payload: terminalInput,
      turn_count: open.turnCount,
      input_tokens: open.inputTokens,
      output_tokens: open.outputTokens,
      total_cost_usd: totalCostUsd,
      completed_at: new Date().toISOString(),
    })
    .eq("id", open.runId);

  return {
    runId: open.runId,
    state,
    terminalTool,
    terminalInput,
    terminalReason,
    turnCount: open.turnCount,
    inputTokens: open.inputTokens,
    outputTokens: open.outputTokens,
    totalCostUsd,
  };
}
