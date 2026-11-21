// Tool fragments shared across multiple agents. Keeps the enum lists,
// descriptions, and schemas in one place so a new document kind or a new
// terminal variant lands in one file rather than four.

import type { AgentTool } from "./types";

// Document kinds — shortest list first so narrower agents can pick a subset.
export const INTAKE_DOC_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
] as const;

export const COMPLIANCE_DOC_KINDS = [
  ...INTAKE_DOC_KINDS,
  "import_permit",
  "endorsement",
] as const;

export const SPECIALIST_DOC_KINDS = [
  ...COMPLIANCE_DOC_KINDS,
  "confirm_destination",
] as const;

export type DocKind =
  | (typeof INTAKE_DOC_KINDS)[number]
  | (typeof COMPLIANCE_DOC_KINDS)[number]
  | (typeof SPECIALIST_DOC_KINDS)[number];

/** `request_document` — enqueued via Comms. Agents differ only in which kinds they can ask for. */
export function requestDocumentTool(
  kinds: readonly string[],
  opts: { description?: string } = {},
): AgentTool {
  return {
    name: "request_document",
    description:
      opts.description ??
      "Terminal: ask the owner via Comms for a missing document.",
    input_schema: {
      type: "object",
      properties: { kind: { type: "string", enum: [...kinds] } },
      required: ["kind"],
    },
  };
}

/** `ask_user_for_input` — single-question prompt, yields until owner replies. */
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

/** `acknowledge_and_wait` — yield the loop without any outbound side effect. */
export const ACKNOWLEDGE_AND_WAIT_TOOL: AgentTool = {
  name: "acknowledge_and_wait",
  description:
    "Terminal: yield the loop without dispatch (e.g. waiting on owner reply or an external event).",
  input_schema: {
    type: "object",
    properties: { reason: { type: "string" } },
    required: ["reason"],
  },
};
