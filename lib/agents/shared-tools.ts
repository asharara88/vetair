// Shared tool primitives reused across agents.
// Hoisted here so that document-kind enums, the wait-for-owner terminal tool,
// and the user-question terminal tool stay in lock-step across the roster.

import type { AgentTool, ModelId } from "./types";

export const MODEL_IDS: readonly ModelId[] = [
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
] as const;

// Document kinds the owner can be asked to upload. The intake-only set is the
// minimum starter pack; the full set adds permits/endorsements that compliance
// + comms + specialists may request later.
export const DOCUMENT_KIND_INTAKE = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
] as const;

export const DOCUMENT_KIND_FULL = [
  ...DOCUMENT_KIND_INTAKE,
  "import_permit",
  "endorsement",
  "health_certificate",
] as const;

export type DocumentKindIntake = (typeof DOCUMENT_KIND_INTAKE)[number];
export type DocumentKindFull = (typeof DOCUMENT_KIND_FULL)[number];

// Terminal tool: yield the loop without dispatching downstream.
// Used by orchestrator (waiting on a peer) and by comms (no nudge needed).
export const ACKNOWLEDGE_AND_WAIT_TOOL: AgentTool = {
  name: "acknowledge_and_wait",
  description: "Terminal: yield the loop without dispatching. Use when the case is paused on owner reply, an external clock, or a downstream agent.",
  input_schema: {
    type: "object",
    properties: { reason: { type: "string" } },
    required: ["reason"],
  },
};

// Terminal tool: ask the owner one question and wait for the reply.
// One question per turn — never multi-prompt.
export const ASK_USER_FOR_INPUT_TOOL: AgentTool = {
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

// Factory: terminal tool to request a document upload from the owner.
// Different agents accept different subsets of kinds, so we parameterize.
export function requestDocumentTool(
  kinds: readonly string[],
  opts: { description?: string; requireChannel?: boolean; requireCaseId?: boolean } = {},
): AgentTool {
  const properties: Record<string, unknown> = {
    kind: { type: "string", enum: [...kinds] },
  };
  const required: string[] = ["kind"];

  if (opts.requireCaseId) {
    properties.case_id = { type: "string" };
    required.unshift("case_id");
  }
  if (opts.requireChannel) {
    properties.channel = { type: "string", enum: ["whatsapp", "email"] };
    required.push("channel");
  }

  return {
    name: "request_document",
    description: opts.description ??
      "Terminal: ask the owner via Comms for a missing document.",
    input_schema: {
      type: "object",
      properties,
      required,
    },
  };
}
