// Shared tool definitions referenced by more than one agent.
// Keeps tool shapes in one place so changes (e.g. adding a field to
// `acknowledge_and_wait`) propagate across every agent that uses them.

import type { AgentTool } from "./types";

export const ACKNOWLEDGE_AND_WAIT_TOOL: AgentTool = {
  name: "acknowledge_and_wait",
  description:
    "Terminal: yield the loop without further dispatch (e.g. waiting on owner reply or upstream signal).",
  input_schema: {
    type: "object",
    properties: { reason: { type: "string" } },
    required: ["reason"],
  },
};

export const ASK_USER_FOR_INPUT_TOOL: AgentTool = {
  name: "ask_user_for_input",
  description:
    "Terminal: send a single-question prompt and yield until the owner replies.",
  input_schema: {
    type: "object",
    properties: {
      field: { type: "string" },
      question: { type: "string" },
    },
    required: ["field", "question"],
  },
};
