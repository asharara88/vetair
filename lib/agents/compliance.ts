// Compliance (Primary) — reasons over case + rule graph and emits an assessment.

import { type AgentDefinition, validateAgent } from "./types";
import { COMPLIANCE_READ_TOOLS, COMPLIANCE_ASSESSMENT_TOOL } from "./_compliance-tools";

export const COMPLIANCE: AgentDefinition = validateAgent({
  name: "compliance",
  type: "compliance",
  model: "claude-sonnet-4-6",
  user_facing_label: "Compliance Team",
  description:
    "Primary compliance voice. Reasons over case data + country rules; emits an assessment with citations and missing requirements.",
  prompt_path: "lib/prompts/compliance.md",
  tools: [
    ...COMPLIANCE_READ_TOOLS,
    COMPLIANCE_ASSESSMENT_TOOL,
    {
      name: "request_document",
      description: "Terminal: ask the owner via Comms for a missing document.",
      input_schema: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["rabies", "microchip", "passport", "vet_records", "import_permit", "endorsement"] },
        },
        required: ["kind"],
      },
    },
    {
      name: "ask_user_for_input",
      description: "Terminal: ask the owner via Comms for a missing fact (e.g. microchip date).",
      input_schema: {
        type: "object",
        properties: {
          field: { type: "string" },
          question: { type: "string" },
        },
        required: ["field", "question"],
      },
    },
  ],
  terminal_tools: ["emit_assessment", "request_document", "ask_user_for_input"],
  budget: { max_turns: 8, max_input_tokens: 60_000 },
});
