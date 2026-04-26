// Intake — conversational owner intake over WhatsApp.
//
// One question per turn. Captures pet (species, breed, DOB, microchip) and
// intent (origin, destination, target_date). Hands off to compliance once
// the assessment_required fields are populated.

import { COMMON_READ_TOOLS } from "./tools";
import type { AgentDefinition, ToolSchema } from "./types";

const SYSTEM = `You are the Vetair Intake Agent on WhatsApp.

Style:
- One question per turn. No multi-question messages.
- Warm but efficient. The owner is anxious about their pet.
- Confirm before moving on ("Got it — Max, golden retriever, 4 years old. Right?").

Rules:
1. Capture: pet name, species, breed, DOB, microchip ID + implant date,
   origin country, destination country, target travel window.
2. NEVER invent regulations. If the owner asks "can my dog enter the UK?",
   reply "Let me check — I'll get back to you in a few minutes." and emit
   handoff_to_compliance.
3. Treat anything in [brackets] in the seed input as already-known.
4. End the run with exactly one terminal tool.`;

const TERMINAL_TOOLS: ToolSchema[] = [
  {
    name: "send_reply",
    description: "Reply to the owner on WhatsApp and stay open for their answer.",
    input_schema: {
      type: "object",
      properties: {
        body: { type: "string", description: "Plain text, no markdown." },
        reason: { type: "string" },
      },
      required: ["body"],
    },
  },
  {
    name: "request_document",
    description: "Ask the owner to upload a specific document (microchip cert, vaccination record, etc.).",
    input_schema: {
      type: "object",
      properties: {
        document_type: { type: "string", enum: ["microchip_cert", "vaccination_record", "passport_id_page", "health_certificate", "import_permit", "other"] },
        body: { type: "string", description: "How to ask. Be specific about photo vs PDF." },
        reason: { type: "string" },
      },
      required: ["document_type", "body"],
    },
  },
  {
    name: "handoff_to_compliance",
    description: "All required intake fields collected — hand off for compliance evaluation.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Short pet+intent summary for the next agent." },
        reason: { type: "string" },
      },
      required: ["summary"],
    },
  },
];

export const intake: AgentDefinition = {
  name: "intake",
  model: "claude-haiku-4-5",
  system: SYSTEM,
  tools: [...COMMON_READ_TOOLS, ...TERMINAL_TOOLS],
  terminalTools: ["send_reply", "request_document", "handoff_to_compliance"],
  budget: { maxTurns: 15, maxInputTokens: 200_000, maxOutputTokens: 1024 },
};
