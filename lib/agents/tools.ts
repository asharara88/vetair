// Shared tool primitives used by more than one agent.
// Local copies in each agent file drift over time; this is the canonical set.

import type { AgentTool } from "./types";

// Master document kinds. Individual agents can subset this list when they only
// solicit a few. The names match the `request_document.kind` enum used by the
// Comms edge function template renderer.
export const DOCUMENT_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
  "import_permit",
  "endorsement",
  "confirm_destination",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Build a `request_document` tool restricted to a subset of kinds. */
export function requestDocumentTool(
  kinds: readonly DocumentKind[],
  opts: {
    description?: string;
    /** Comms wraps the request with `case_id` + `channel`; intake/compliance do not. */
    withCaseAndChannel?: boolean;
  } = {},
): AgentTool {
  const { description, withCaseAndChannel = false } = opts;
  if (withCaseAndChannel) {
    return {
      name: "request_document",
      description:
        description ??
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
  return {
    name: "request_document",
    description: description ?? "Ask the owner to upload a specific document type.",
    input_schema: {
      type: "object",
      properties: { kind: { type: "string", enum: [...kinds] } },
      required: ["kind"],
    },
  };
}

/** Single-question prompt to the owner; used by intake + compliance. */
export const ASK_USER_FOR_INPUT_TOOL: AgentTool = {
  name: "ask_user_for_input",
  description:
    "Terminal: send a single-question prompt and yield until the owner replies.",
  input_schema: {
    type: "object",
    properties: {
      field: { type: "string" },
      question: { type: "string" },
    },
    required: ["field", "question"],
  },
};

/** Yield the loop without dispatch; used by orchestrator + comms. */
export const ACKNOWLEDGE_AND_WAIT_TOOL: AgentTool = {
  name: "acknowledge_and_wait",
  description:
    "Terminal: yield the loop without dispatch (e.g. waiting on owner reply).",
  input_schema: {
    type: "object",
    properties: { reason: { type: "string" } },
    required: ["reason"],
  },
};

/** Read the most recent compliance assessment for a case. */
export const READ_ASSESSMENT_TOOL: AgentTool = {
  name: "read_assessment",
  description:
    "Read the most recent compliance assessment for a case (verdict, summary, cited_rules, requirements_missing).",
  input_schema: {
    type: "object",
    properties: { case_id: { type: "string" } },
    required: ["case_id"],
  },
};

/** Read a case row by id. Used by every dispatch-aware agent. */
export const READ_CASE_TOOL: AgentTool = {
  name: "read_case",
  description: "Read a case row by id, including state and budget counters.",
  input_schema: {
    type: "object",
    properties: { case_id: { type: "string" } },
    required: ["case_id"],
  },
};

/** Read pet facts for a case. */
export const READ_PET_FACTS_TOOL: AgentTool = {
  name: "read_pet_facts",
  description: "Read the pet row for a case.",
  input_schema: {
    type: "object",
    properties: { case_id: { type: "string" } },
    required: ["case_id"],
  },
};
