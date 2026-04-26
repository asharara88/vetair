// Compliance — primary voice in the three-voice spine.
//
// Reasons over case + pet + documents + country_rules and emits an
// assessment with per-rule status + a final verdict. The Auditor is the
// adversarial counterpart (lib/agents/auditor.ts); the deterministic engine
// (lib/compliance/evaluators.ts) is the third voice.
//
// CRITICAL: this agent must ONLY cite requirement_codes that appear in the
// rules it queried. Hallucinated codes are a class-A bug.

import { COMMON_READ_TOOLS, POST_MESSAGE_TOOL } from "./tools";
import type { AgentDefinition, ToolSchema } from "./types";

const SYSTEM = `You are the Vetair Compliance Agent (Primary Voice).

Process:
1. read_case + read_pet + list_documents + query_rules. Always. No assumptions.
2. For each rule, decide: satisfied / pending / blocked / not_applicable.
3. Compute overall verdict: approved | blocked | pending. Provide the
   earliest_legal_departure date if any wait period is the binding constraint.
4. Emit your assessment via emit_assessment. The Auditor will adversarially
   review it.

Hallucination control: if a requirement_code is not in the rules you fetched,
you cannot cite it. Period. If the rule set is empty for the corridor, emit
emit_assessment with verdict='pending' and rationale explaining the gap.`;

const EMIT_ASSESSMENT: ToolSchema = {
  name: "emit_assessment",
  description: "Final assessment for the case. Terminal.",
  input_schema: {
    type: "object",
    properties: {
      verdict: { type: "string", enum: ["approved", "blocked", "pending"] },
      earliest_legal_departure: { type: "string", description: "ISO date or null" },
      rationale: { type: "string", description: "One paragraph citing requirement_codes." },
      per_rule: {
        type: "array",
        items: {
          type: "object",
          properties: {
            requirement_code: { type: "string" },
            status: { type: "string", enum: ["satisfied", "pending", "blocked", "not_applicable"] },
            notes: { type: "string" },
          },
          required: ["requirement_code", "status"],
        },
      },
      reason: { type: "string" },
    },
    required: ["verdict", "rationale", "per_rule"],
  },
};

export const compliance: AgentDefinition = {
  name: "compliance",
  model: "claude-sonnet-4-6",
  system: SYSTEM,
  tools: [...COMMON_READ_TOOLS, POST_MESSAGE_TOOL, EMIT_ASSESSMENT],
  terminalTools: ["emit_assessment"],
  budget: { maxTurns: 12, maxInputTokens: 200_000, maxOutputTokens: 4096 },
};
