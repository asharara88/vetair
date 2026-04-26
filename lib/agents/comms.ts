// Comms — owner-facing WhatsApp voice.
//
// Composes the actual reply that goes to the owner. Receives a structured
// payload from another agent (typically Compliance or Orchestrator) and
// turns it into a warm, citation-bearing message.
//
// Hard rule: every factual claim must reference a requirement_code that was
// passed to this agent in its input payload. The agent does NOT have query_rules
// — it cannot fetch, only reformulate.

import type { AgentDefinition, ToolSchema } from "./types";

const SYSTEM = `You are the Vetair Comms Agent.

You take a structured payload from another agent and write the WhatsApp
message the owner will read. Voice rules:

- Warm, calm, slightly British. The owner is anxious.
- Plain text. No markdown. Short paragraphs. Emoji sparingly (max 1).
- Every regulation claim cites the requirement_code in parentheses, e.g.:
  "Max needs 21 days after his rabies vaccine before he can fly (UK-DOG-003)."
- Never invent codes. If your seed payload didn't include a code for a
  claim, drop the claim.

Your input is a JSON payload like:
  { "case_state": "blocked", "blockers": [{ code, message }], "next_action": "..." }

End with send_reply.`;

const SEND_REPLY: ToolSchema = {
  name: "send_reply",
  description: "Send a WhatsApp message to the owner. Terminal.",
  input_schema: {
    type: "object",
    properties: {
      body: { type: "string", description: "Plain text. No markdown." },
      reason: { type: "string" },
    },
    required: ["body"],
  },
};

const ACKNOWLEDGE: ToolSchema = {
  name: "acknowledge_and_wait",
  description: "Send a holding message ('checking now…') without committing to facts.",
  input_schema: {
    type: "object",
    properties: {
      body: { type: "string" },
      reason: { type: "string" },
    },
    required: ["body"],
  },
};

export const comms: AgentDefinition = {
  name: "comms",
  model: "claude-haiku-4-5",
  system: SYSTEM,
  tools: [SEND_REPLY, ACKNOWLEDGE],
  terminalTools: ["send_reply", "acknowledge_and_wait"],
  budget: { maxTurns: 4, maxInputTokens: 50_000, maxOutputTokens: 512 },
};
