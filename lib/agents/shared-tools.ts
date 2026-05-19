// Shared tool builders.
//
// A handful of tool shapes recur across agents (request_document,
// ask_user_for_input, acknowledge_and_wait, read_case). Defining them once —
// with explicit literal-typed `input_schema` — keeps validateAgent() happy
// and removes the "type: 'object' as const" boilerplate that was scattered
// across each agent file.

import type { AgentTool } from "./types";

// All known document kinds the platform can request from an owner.
// Specialist agents pass a subset that's relevant to their corridor.
export const DOCUMENT_KIND = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
  "import_permit",
  "endorsement",
  "confirm_destination",
] as const;
export type DocumentKind = (typeof DOCUMENT_KIND)[number];

// Tool: request_document — basic form (kind only).
// Intake/Compliance/Specialist call it as a dispatch into Comms.
export function requestDocumentTool(
  kinds: readonly DocumentKind[],
): AgentTool {
  return {
    name: "request_document",
    description: "Terminal: ask the owner via Comms for a missing document.",
    input_schema: {
      type: "object",
      properties: { kind: { type: "string", enum: [...kinds] } },
      required: ["kind"],
    },
  };
}

// Tool: request_document — Comms variant. Routes a templated nudge.
export function requestDocumentCommsTool(
  kinds: readonly DocumentKind[],
): AgentTool {
  return {
    name: "request_document",
    description:
      "Terminal: send the owner a templated request for a specific document type.",
    input_schema: {
      type: "object",
      properties: {
        case_id: { type: "string" },
        channel: { type: "string", enum: ["whatsapp", "email"] },
        kind: { type: "string", enum: [...kinds] },
      },
      required: ["case_id", "channel", "kind"],
    },
  };
}

// Tool: ask_user_for_input — single-question, terminal.
export const ASK_USER_FOR_INPUT_TOOL: AgentTool = {
  name: "ask_user_for_input",
  description:
    "Terminal: ask the owner via Comms for a missing fact in one question. Yields the loop until the owner replies.",
  input_schema: {
    type: "object",
    properties: {
      field: { type: "string" },
      question: { type: "string" },
    },
    required: ["field", "question"],
  },
};

// Tool: acknowledge_and_wait — terminal, no-op.
export const ACKNOWLEDGE_AND_WAIT_TOOL: AgentTool = {
  name: "acknowledge_and_wait",
  description: "Terminal: yield without dispatch. Use when no action is needed.",
  input_schema: {
    type: "object",
    properties: { reason: { type: "string" } },
    required: ["reason"],
  },
};

// Tool: read_case — read a case row by id.
export const READ_CASE_TOOL: AgentTool = {
  name: "read_case",
  description: "Read a case row by id, including state and budget counters.",
  input_schema: {
    type: "object",
    properties: { case_id: { type: "string" } },
    required: ["case_id"],
  },
};

// Tool: read_assessment — read the latest compliance assessment for a case.
export const READ_ASSESSMENT_TOOL: AgentTool = {
  name: "read_assessment",
  description:
    "Read the most recent compliance assessment for a case (verdict, summary, cited_rules, requirements_missing, earliest_legal_departure).",
  input_schema: {
    type: "object",
    properties: { case_id: { type: "string" } },
    required: ["case_id"],
  },
};
