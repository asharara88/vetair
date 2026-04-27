// Orchestrator — the routing brain.
//
// Reads case state, decides the next step, and either:
//   - dispatches another agent via post_agent_message + dispatch_to_agent,
//   - asks the owner for missing input via ask_user_for_input,
//   - or closes the case via close_case (terminal happy path).
//
// Budget: 20 turns is plenty — orchestrator should reach a terminal in 3-5.

import {
  COMMON_READ_TOOLS,
  POST_MESSAGE_TOOL,
  UPDATE_CASE_STATE_TOOL,
} from "./tools";
import type { AgentDefinition, ToolSchema } from "./types";

const SYSTEM = `You are the Vetair Orchestrator. You route a case through the
multi-agent pipeline: intake → compliance → auditor → (booking →) close_case.

Operating rules:
1. Read the current case + pet + documents before deciding.
2. NEVER invent regulations. Use specialist agents for domain claims.
3. Pick exactly ONE next step per turn. Either dispatch an agent, ask the
   owner a question, or close the case.
4. Two unresolved dissent rounds escalates to a human via escalate_to_human.
5. Every terminal call must include a human-readable 'reason' explaining
   WHY this step is correct given the case state.

Output: end the run with a single terminal tool. Do not narrate in prose.`;

const TERMINAL_TOOLS: ToolSchema[] = [
  {
    name: "dispatch_to_agent",
    description: "Hand the case off to a specific agent for the next step.",
    input_schema: {
      type: "object",
      properties: {
        agent: {
          type: "string",
          enum: ["intake", "compliance", "auditor", "comms", "synthesizer"],
        },
        reason: { type: "string" },
        payload: { type: "object" },
      },
      required: ["agent", "reason"],
    },
  },
  {
    name: "ask_user_for_input",
    description: "Pause routing because the owner must supply something.",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "What to ask the owner." },
        reason: { type: "string" },
      },
      required: ["prompt", "reason"],
    },
  },
  {
    name: "close_case",
    description: "Terminal: the case is finished (approved, blocked, or cancelled).",
    input_schema: {
      type: "object",
      properties: {
        outcome: { type: "string", enum: ["approved", "blocked", "cancelled"] },
        reason: { type: "string" },
      },
      required: ["outcome", "reason"],
    },
  },
  {
    name: "escalate_to_human",
    description: "Hand off to a human operator. Use only after dissent could not resolve.",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string" } },
      required: ["reason"],
    },
  },
];

export const orchestrator: AgentDefinition = {
  name: "orchestrator",
  model: "claude-sonnet-4-6",
  system: SYSTEM,
  tools: [...COMMON_READ_TOOLS, POST_MESSAGE_TOOL, UPDATE_CASE_STATE_TOOL, ...TERMINAL_TOOLS],
  terminalTools: ["dispatch_to_agent", "ask_user_for_input", "close_case", "escalate_to_human"],
  budget: { maxTurns: 20, maxInputTokens: 500_000, maxOutputTokens: 2048 },
};
