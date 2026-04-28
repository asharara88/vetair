// Compliance Auditor — adversarial reviewer. Concur or dissent.

import { type AgentDefinition, validateAgent } from "./types";
import { COMPLIANCE_SHARED_READ_TOOLS } from "./compliance";

export const AUDITOR: AgentDefinition = validateAgent({
  name: "auditor",
  type: "auditor",
  model: "claude-opus-4-7",
  user_facing_label: "Senior Auditor",
  description:
    "Adversarial reviewer. Re-reads the compliance assessment with reverse framing and either concurs or dissents with challenges.",
  prompt_path: "lib/prompts/auditor.md",
  tools: [
    ...COMPLIANCE_SHARED_READ_TOOLS,
    {
      name: "concur",
      description: "Terminal: agree with the primary assessment. Reasoning must enumerate the requirement_codes re-checked.",
      input_schema: {
        type: "object",
        properties: { reasoning: { type: "string" } },
        required: ["reasoning"],
      },
    },
    {
      name: "dissent",
      description: "Terminal: disagree with the primary assessment. Each challenge must cite a requirement_code.",
      input_schema: {
        type: "object",
        properties: {
          reasoning: { type: "string" },
          challenges: {
            type: "array",
            items: {
              type: "object",
              properties: {
                requirement_code: { type: "string" },
                challenge: { type: "string" },
              },
              required: ["requirement_code", "challenge"],
            },
            minItems: 1,
          },
        },
        required: ["reasoning", "challenges"],
      },
    },
  ],
  terminal_tools: ["concur", "dissent"],
  budget: { max_turns: 6, max_input_tokens: 60_000 },
});
