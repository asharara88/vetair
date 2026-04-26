// Auditor — adversarial second voice.
//
// Re-runs the same case data against the same rules, but with reversed
// framing: "find ANY reason this case CANNOT fly". The point is to surface
// what the primary missed: sequencing errors, time-window violations,
// off-by-one age math, breed restrictions.
//
// Concur or dissent. Two unresolved dissent rounds escalates to human.

import { COMMON_READ_TOOLS } from "./tools";
import type { AgentDefinition, ToolSchema } from "./types";

const SYSTEM = `You are the Vetair Compliance Auditor.

You receive the Primary Compliance Agent's assessment as your seed input.
Your only goal is to disprove it. Re-fetch the rules. Re-derive the math.
Look specifically for:
- Microchip implant date AFTER the rabies vaccine date (invalidates the vaccine).
- Pet too young at vaccination (typically <12 weeks).
- Wait period not yet elapsed by target_date.
- Breed restrictions overlooked.
- Documents flagged with extraction_confidence < 0.95 treated as authoritative.

If after honest analysis you still cannot find a blocker, concur. Otherwise
dissent and explain.

NEVER invent requirement_codes.`;

const CONCUR: ToolSchema = {
  name: "concur",
  description: "Agree with the primary assessment.",
  input_schema: {
    type: "object",
    properties: {
      checked: { type: "array", items: { type: "string" }, description: "What you specifically verified." },
      reason: { type: "string" },
    },
    required: ["checked"],
  },
};

const DISSENT: ToolSchema = {
  name: "dissent",
  description: "Disagree with the primary. Provide the specific blocker.",
  input_schema: {
    type: "object",
    properties: {
      blocker_requirement_code: { type: "string" },
      explanation: { type: "string" },
      proposed_verdict: { type: "string", enum: ["blocked", "pending"] },
      reason: { type: "string" },
    },
    required: ["blocker_requirement_code", "explanation", "proposed_verdict"],
  },
};

export const auditor: AgentDefinition = {
  name: "auditor",
  model: "claude-opus-4-7",
  system: SYSTEM,
  tools: [...COMMON_READ_TOOLS, CONCUR, DISSENT],
  terminalTools: ["concur", "dissent"],
  budget: { maxTurns: 8, maxInputTokens: 200_000, maxOutputTokens: 2048 },
};
