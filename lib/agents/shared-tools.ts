// Reusable tool building blocks shared across multiple agents.
// Keeping these in one place avoids drift when we tighten the schema —
// e.g. if `acknowledge_and_wait.reason` ever gains a `category` field, we
// only update it here.

import type { AgentTool } from "./types";

export const ACKNOWLEDGE_AND_WAIT_TOOL: AgentTool = {
  name: "acknowledge_and_wait",
  description: "Terminal: yield the loop without dispatch. Use when there is no productive action right now (waiting on owner, on a clock, or assessment already final).",
  input_schema: {
    type: "object",
    properties: { reason: { type: "string" } },
    required: ["reason"],
  },
};

export const ASK_USER_FOR_INPUT_TOOL: AgentTool = {
  name: "ask_user_for_input",
  description: "Terminal: ask the owner for a single missing fact and yield until they reply.",
  input_schema: {
    type: "object",
    properties: {
      field: { type: "string" },
      question: { type: "string" },
    },
    required: ["field", "question"],
  },
};

/**
 * Build a `request_document` tool with the kinds this agent is allowed to ask for.
 * Each agent has a tighter or looser set (intake only asks for basics; comms
 * and specialist may chase any kind), so the enum is a per-call parameter.
 */
export function requestDocumentTool(kinds: readonly string[]): AgentTool {
  return {
    name: "request_document",
    description: "Terminal: ask the owner via Comms for a missing document.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: [...kinds] },
      },
      required: ["kind"],
    },
  };
}
