// Comms — outbound owner channel. WhatsApp-first, with email + SMS fallbacks.
// Every customer-facing claim must trace back to a requirement_code; the prompt
// blocks free-text regulatory advice. Tone is warm, never breezy.

import { type AgentDefinition, validateAgent } from "./types";
import {
  ACKNOWLEDGE_AND_WAIT_TOOL,
  CASE_ID_INPUT,
  DOCUMENT_KINDS,
  requestDocumentTool,
} from "./shared-tools";

export const COMMS: AgentDefinition = validateAgent({
  name: "comms",
  type: "comms",
  model: "claude-haiku-4-5",
  user_facing_label: "Comms Team",
  description:
    "Outbound owner communication. Citation-enforced WhatsApp + email; never invents requirements, always grounds in cited rules.",
  prompt_path: "lib/prompts/comms.md",
  tools: [
    {
      name: "read_recent_thread",
      description: "Read the last N messages on the owner's active thread, both directions.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 30 },
        },
        required: ["case_id"],
      },
    },
    {
      name: "read_assessment",
      description: "Read the most recent compliance assessment for a case (verdict, summary, cited_rules, requirements_missing).",
      input_schema: CASE_ID_INPUT,
    },
    {
      name: "send_outbound",
      description:
        "Terminal: send a single owner-facing message. The body must be grounded in `cited_rules`; including a requirement_code that is not in the cited set is a hard error.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          channel: { type: "string", enum: ["whatsapp", "email", "sms"] },
          body: { type: "string" },
          cited_rules: {
            type: "array",
            items: { type: "string" },
            description: "Requirement codes that back any factual claim in the body.",
          },
        },
        required: ["case_id", "channel", "body", "cited_rules"],
      },
    },
    requestDocumentTool({
      kinds: DOCUMENT_KINDS,
      withChannel: true,
      withCaseId: true,
      description: "Terminal: send the owner a templated request for a specific document type.",
    }),
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: ["send_outbound", "request_document", "acknowledge_and_wait"],
  budget: { max_turns: 4, max_input_tokens: 30_000 },
});
