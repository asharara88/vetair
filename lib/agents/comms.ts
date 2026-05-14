// Comms — outbound owner channel. WhatsApp-first, with email + SMS fallbacks.
// Every customer-facing claim must trace back to a requirement_code; the prompt
// blocks free-text regulatory advice. Tone is warm, never breezy.

import { type AgentDefinition, validateAgent } from "./types";
import {
  COMMS_CHANNELS,
  COMPLIANCE_DOCUMENT_KINDS,
  acknowledgeAndWaitTool,
  readAssessmentTool,
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
    readAssessmentTool(),
    {
      name: "send_outbound",
      description:
        "Terminal: send a single owner-facing message. The body must be grounded in `cited_rules`; including a requirement_code that is not in the cited set is a hard error.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          channel: { type: "string", enum: [...COMMS_CHANNELS] },
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
      kinds: COMPLIANCE_DOCUMENT_KINDS,
      withCaseAndChannel: true,
      description: "Terminal: send the owner a templated request for a specific document type.",
    }),
    acknowledgeAndWaitTool(
      "Terminal: yield without sending. Use when the assessment is final and no owner-facing nudge is needed.",
    ),
  ],
  terminal_tools: ["send_outbound", "request_document", "acknowledge_and_wait"],
  budget: { max_turns: 4, max_input_tokens: 30_000 },
});
