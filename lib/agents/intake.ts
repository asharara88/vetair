// Intake — conversational onboarding via WhatsApp. One question per turn.

import { type AgentDefinition, validateAgent } from "./types";
import {
  CASE_ID_INPUT,
  DOCUMENT_KINDS_INTAKE,
  TERMINAL_ASK_USER,
  requestDocumentTool,
} from "./shared";

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
    requestDocumentTool(DOCUMENT_KINDS_INTAKE),
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
    TERMINAL_ASK_USER,
    {
      name: "handoff_to_compliance",
      description: "Terminal: enqueue the compliance assessment task.",
      input_schema: CASE_ID_INPUT,
    },
  ],
  terminal_tools: ["ask_user_for_input", "handoff_to_compliance"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
