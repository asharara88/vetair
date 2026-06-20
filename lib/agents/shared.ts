// Shared schema fragments used by more than one agent definition.
// Keeping these in one place ensures the JSON-schema for "request a document
// of kind X" or "yield until the owner replies" is identical wherever it
// appears, so the orchestrator can dispatch and the LLM never sees drift.

import type { AgentTool } from "./types";

// ---------- input-schema fragments ----------

/** `{ case_id: string }` — required by most read tools. */
export const CASE_ID_INPUT = {
  type: "object" as const,
  properties: { case_id: { type: "string" } },
  required: ["case_id"],
};

/** `{ case_id: string, ...extras }` — required `case_id` + caller-supplied props. */
export function caseIdInputWith(
  extras: Record<string, unknown>,
  required: string[] = [],
): AgentTool["input_schema"] {
  return {
    type: "object",
    properties: { case_id: { type: "string" }, ...extras },
    required: ["case_id", ...required],
  };
}

// ---------- document-kind enums ----------
// Each successive set is a superset of the previous one.

export const DOCUMENT_KINDS_INTAKE = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
] as const;

export const DOCUMENT_KINDS_COMPLIANCE = [
  ...DOCUMENT_KINDS_INTAKE,
  "import_permit",
  "endorsement",
] as const;

export const DOCUMENT_KINDS_SPECIALIST = [
  ...DOCUMENT_KINDS_COMPLIANCE,
  "confirm_destination",
] as const;

// ---------- common terminal tools ----------

/** `acknowledge_and_wait` — yield the agent loop without further action. */
export const TERMINAL_ACK: AgentTool = {
  name: "acknowledge_and_wait",
  description: "Terminal: yield the loop without dispatch (e.g. waiting on owner reply).",
  input_schema: {
    type: "object",
    properties: { reason: { type: "string" } },
    required: ["reason"],
  },
};

/** `ask_user_for_input` — send a single-question prompt and yield. */
export const TERMINAL_ASK_USER: AgentTool = {
  name: "ask_user_for_input",
  description: "Terminal: send a single-question prompt and yield until the owner replies.",
  input_schema: {
    type: "object",
    properties: {
      field: { type: "string" },
      question: { type: "string" },
    },
    required: ["field", "question"],
  },
};

/**
 * `request_document` — ask the owner via Comms for a missing document.
 *
 * The enum differs per agent (intake supports fewer kinds than specialist),
 * so callers pass the exact set they accept.
 */
export function requestDocumentTool(
  kinds: readonly string[],
  options: { withCaseId?: boolean; withChannel?: boolean } = {},
): AgentTool {
  const { withCaseId = false, withChannel = false } = options;
  const properties: Record<string, unknown> = {
    kind: { type: "string", enum: [...kinds] },
  };
  const required: string[] = ["kind"];
  if (withCaseId) {
    properties.case_id = { type: "string" };
    required.unshift("case_id");
  }
  if (withChannel) {
    properties.channel = { type: "string", enum: ["whatsapp", "email"] };
    required.splice(required.length - 1, 0, "channel"); // before "kind"
  }
  return {
    name: "request_document",
    description: withCaseId
      ? "Terminal: send the owner a templated request for a specific document type."
      : "Terminal: ask the owner via Comms for a missing document.",
    input_schema: { type: "object", properties, required },
  };
}
