// Comms — outbound owner channel. WhatsApp-first, with email + SMS fallbacks.
// Every customer-facing claim must trace back to a requirement_code; the prompt
// blocks free-text regulatory advice. Tone is warm, never breezy.

import { type AgentDefinition, validateAgent } from "./types";

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
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
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
    {
      name: "request_document",
      description: "Terminal: send the owner a templated request for a specific document type.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          channel: { type: "string", enum: ["whatsapp", "email"] },
          kind: {
            type: "string",
            enum: ["rabies", "microchip", "passport", "vet_records", "import_permit", "endorsement"],
          },
        },
        required: ["case_id", "channel", "kind"],
      },
    },
    {
      name: "acknowledge_and_wait",
      description: "Terminal: yield without sending. Use when the assessment is final and no owner-facing nudge is needed.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: ["send_outbound", "request_document", "acknowledge_and_wait"],
  budget: { max_turns: 4, max_input_tokens: 30_000 },
});
