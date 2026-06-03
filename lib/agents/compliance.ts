// Compliance (Primary) — reasons over case + rule graph and emits an assessment.

import { type AgentDefinition, validateAgent } from "./types";
import {
  ASK_USER_FOR_INPUT,
  COMPLIANCE_READ_TOOLS,
  EMIT_ASSESSMENT,
  requestDocumentTool,
} from "./tools";

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
    EMIT_ASSESSMENT,
    requestDocumentTool("simple"),
    ASK_USER_FOR_INPUT,
  ],
  terminal_tools: ["emit_assessment", "request_document", "ask_user_for_input"],
  budget: { max_turns: 8, max_input_tokens: 60_000 },
});
