// Shared tool fragments + enums reused across agents.
// Keeping these here avoids drift when (e.g.) a new document kind is added to
// one agent's request_document enum but forgotten elsewhere.

import type { AgentTool } from "./types";

export const DOCUMENT_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
  "import_permit",
  "endorsement",
  "health_certificate",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Standard "ask Comms to chase a document" terminal tool. */
export const REQUEST_DOCUMENT_TOOL: AgentTool = {
  name: "request_document",
  description: "Terminal: ask the owner via Comms for a missing document.",
  input_schema: {
    type: "object",
    properties: { kind: { type: "string", enum: [...DOCUMENT_KINDS] } },
    required: ["kind"],
  },
};

/** Standard "ask Comms to chase a missing fact" terminal tool. */
export const ASK_USER_FOR_INPUT_TOOL: AgentTool = {
  name: "ask_user_for_input",
  description:
    "Terminal: ask the owner via Comms for a single missing fact (one question per turn).",
  input_schema: {
    type: "object",
    properties: {
      field: { type: "string" },
      question: { type: "string" },
    },
    required: ["field", "question"],
  },
};

/** Standard "I'm done, no further action" terminal tool. */
export const ACKNOWLEDGE_AND_WAIT_TOOL: AgentTool = {
  name: "acknowledge_and_wait",
  description: "Terminal: yield the loop without dispatch (waiting on an external action).",
  input_schema: {
    type: "object",
    properties: { reason: { type: "string" } },
    required: ["reason"],
  },
};
