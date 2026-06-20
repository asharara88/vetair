// Shared tool definitions reused across multiple agents.
// Keeps individual agent files focused on their own dispatch shape; centralises
// the schemas the orchestrator and the UI inspect for consistency.

import type { AgentTool } from "./types";

// Input schema for any tool that takes only a case_id. Re-used so each agent
// file doesn't redefine the same six lines.
export const CASE_ID_INPUT = {
  type: "object" as const,
  properties: { case_id: { type: "string" } },
  required: ["case_id"],
};

// Yield the loop without dispatching. Same shape for every agent that supports it.
export const ACKNOWLEDGE_AND_WAIT_TOOL: AgentTool = {
  name: "acknowledge_and_wait",
  description: "Terminal: yield the loop without dispatch.",
  input_schema: {
    type: "object",
    properties: { reason: { type: "string" } },
    required: ["reason"],
  },
};

// Ask the owner (via Comms) for a single fact. Identical schema across intake +
// compliance + specialist; only the surrounding rules differ.
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

// Document kinds an agent can request from the owner. Centralising the enum
// stops drift between intake / compliance / comms over time.
export const DOCUMENT_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
  "import_permit",
  "endorsement",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

// Build a `request_document` tool with a custom subset of kinds — intake only
// asks for the four owner-provided ones; compliance + specialist need the full
// set; comms also needs a `channel` selector.
export function requestDocumentTool(opts: {
  kinds: readonly string[];
  withChannel?: boolean;
  withCaseId?: boolean;
  description?: string;
}): AgentTool {
  const properties: Record<string, unknown> = {
    kind: { type: "string", enum: [...opts.kinds] },
  };
  const required = ["kind"];
  if (opts.withCaseId) {
    properties.case_id = { type: "string" };
    required.unshift("case_id");
  }
  if (opts.withChannel) {
    properties.channel = { type: "string", enum: ["whatsapp", "email"] };
    required.push("channel");
  }
  return {
    name: "request_document",
    description:
      opts.description ?? "Terminal: ask the owner via Comms for a missing document.",
    input_schema: {
      type: "object",
      properties,
      required,
    },
  };
}
