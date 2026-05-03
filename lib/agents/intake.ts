// Intake — conversational onboarding via WhatsApp. One question per turn.

import { type AgentDefinition, validateAgent } from "./types";
import {
  ASK_USER_FOR_INPUT_TOOL,
  DOCUMENT_KIND_INTAKE,
  requestDocumentTool,
} from "./shared-tools";

export const INTAKE: AgentDefinition = validateAgent({
  name: "intake",
  type: "intake",
  model: "claude-haiku-4-5",
  user_facing_label: "Intake Team",
  description:
    "Conversational onboarding via WhatsApp. Captures owner + pet + intent. One question per turn, never multi-prompts.",
  prompt_path: "lib/prompts/intake.md",
  tools: [
    {
      name: "send_reply",
      description: "Send a free-form WhatsApp reply on the active thread.",
      input_schema: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
      },
    },
    requestDocumentTool(DOCUMENT_KIND_INTAKE, {
      description: "Ask the owner to upload a specific document type.",
    }),
    {
      name: "update_case_facts",
      description: "Patch the case row with confirmed owner-supplied fields.",
      input_schema: {
        type: "object",
        properties: { patch: { type: "object" } },
        required: ["patch"],
      },
    },
    {
      name: "update_pet_facts",
      description: "Patch the pet row with confirmed owner-supplied fields.",
      input_schema: {
        type: "object",
        properties: { patch: { type: "object" } },
        required: ["patch"],
      },
    },
    ASK_USER_FOR_INPUT_TOOL,
    {
      name: "handoff_to_compliance",
      description: "Terminal: enqueue the compliance assessment task.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
  ],
  terminal_tools: ["ask_user_for_input", "handoff_to_compliance"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
