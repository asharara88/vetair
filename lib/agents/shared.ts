// Shared enums + tool fragments referenced by multiple agent definitions.
// Centralizing them eliminates the per-file copies of {kind} / {channel} that
// previously drifted between intake / compliance / specialist / comms.

import type { AgentTool, ModelId } from "./types";

// ---------- enums shared by tool schemas ----------

export const MODEL_IDS = [
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
] as const satisfies readonly ModelId[];

// Document types we ever ask the owner to upload. Subsets are chosen per-agent
// so intake doesn't offer "endorsement" before compliance has assessed.
export const BASE_DOCUMENT_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
] as const;

export const COMPLIANCE_DOCUMENT_KINDS = [
  ...BASE_DOCUMENT_KINDS,
  "import_permit",
  "endorsement",
] as const;

export const SPECIALIST_DOCUMENT_KINDS = [
  ...COMPLIANCE_DOCUMENT_KINDS,
  "confirm_destination",
] as const;

export type DocumentKind = (typeof SPECIALIST_DOCUMENT_KINDS)[number];

// Owner-facing channels. Comms defaults to whatsapp; sms is a last-resort fallback.
export const OUTBOUND_CHANNELS = ["whatsapp", "email", "sms"] as const;
export const TEMPLATED_CHANNELS = ["whatsapp", "email"] as const;
export type OutboundChannel = (typeof OUTBOUND_CHANNELS)[number];

// ---------- tool factories shared across agents ----------

/**
 * Templated "ask the owner to upload X" tool. Reused by intake, compliance,
 * comms, and synthesized specialists — each may narrow the kind set.
 */
export function requestDocumentTool(
  kinds: readonly string[],
  opts: { withCaseAndChannel?: boolean; description?: string } = {},
): AgentTool {
  if (opts.withCaseAndChannel) {
    return {
      name: "request_document",
      description:
        opts.description ??
        "Terminal: send the owner a templated request for a specific document type.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          channel: { type: "string", enum: [...TEMPLATED_CHANNELS] },
          kind: { type: "string", enum: [...kinds] },
        },
        required: ["case_id", "channel", "kind"],
      },
    };
  }
  return {
    name: "request_document",
    description: opts.description ?? "Terminal: ask the owner via Comms for a missing document.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: [...kinds] },
      },
      required: ["kind"],
    },
  };
}

/**
 * Single-question prompt that yields the loop until the owner replies.
 * Used by intake (immediately) and compliance (when missing a fact).
 */
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

/**
 * Yield without dispatching. Multiple agents share this verbatim — orchestrator,
 * comms, vet-network, endorsement.
 */
export const ACKNOWLEDGE_AND_WAIT_TOOL: AgentTool = {
  name: "acknowledge_and_wait",
  description:
    "Terminal: yield the loop without dispatch (e.g. waiting on owner reply or external system).",
  input_schema: {
    type: "object",
    properties: { reason: { type: "string" } },
    required: ["reason"],
  },
};

/** Read the case row by id. Trivially shared between most read-only loops. */
export const READ_CASE_TOOL: AgentTool = {
  name: "read_case",
  description: "Read a case row by id, including state and budget counters.",
  input_schema: {
    type: "object",
    properties: { case_id: { type: "string" } },
    required: ["case_id"],
  },
};
