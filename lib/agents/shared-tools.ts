// Tool shapes shared across multiple agents. Centralized so the enums
// (e.g. `kind` for request_document) stay aligned, and so tool descriptions
// can be tightened in one place.

import type { AgentTool } from "./types";

export const DOCUMENT_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
  "import_permit",
  "endorsement",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const REQUEST_DOCUMENT_TOOL: AgentTool = {
  name: "request_document",
  description: "Terminal: ask the owner via Comms for a missing document.",
  input_schema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: [...DOCUMENT_KINDS] },
    },
    required: ["kind"],
  },
};

export const ASK_USER_FOR_INPUT_TOOL: AgentTool = {
  name: "ask_user_for_input",
  description: "Terminal: ask the owner a single targeted question and yield until they reply.",
  input_schema: {
    type: "object",
    properties: {
      field: { type: "string" },
      question: { type: "string" },
    },
    required: ["field", "question"],
  },
};

export const ACKNOWLEDGE_AND_WAIT_TOOL: AgentTool = {
  name: "acknowledge_and_wait",
  description: "Terminal: yield the loop without dispatch. Use when no action is needed right now.",
  input_schema: {
    type: "object",
    properties: { reason: { type: "string" } },
    required: ["reason"],
  },
};
