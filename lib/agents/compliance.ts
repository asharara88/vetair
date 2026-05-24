// Compliance (Primary) — reasons over case + rule graph and emits an assessment.

import { type AgentDefinition, validateAgent } from "./types";
import {
  ASK_USER_FOR_INPUT_TOOL,
  COMPLIANCE_ASSESSMENT_TOOL,
  COMPLIANCE_READ_TOOLS,
  DOCUMENT_KINDS_FULL,
  requestDocumentDispatchTool,
} from "./shared-tools";

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
    requestDocumentDispatchTool(DOCUMENT_KINDS_FULL, { terminal: true }),
    ASK_USER_FOR_INPUT_TOOL,
  ],
  terminal_tools: ["emit_assessment", "request_document", "ask_user_for_input"],
  budget: { max_turns: 8, max_input_tokens: 60_000 },
});
