// Shared tool-schema fragments for agent definitions.
// Each agent file imports the pieces it needs; this is the single source of
// truth for things like `request_document`'s document-kind enum or the
// `case_id`-keyed read tools, which previously drifted slightly between agents.

import type { AgentTool } from "./types";

// ---------- shared enums ----------

// Documents an agent (or owner) might be asked to upload.
// Keep this list in sync with the `documents.document_type` CHECK constraint.
export const DOCUMENT_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
  "import_permit",
  "endorsement",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

// Synthesized specialists also accept this sentinel to confirm the destination
// before silently proceeding under a wrong jurisdiction.
export const DOCUMENT_KINDS_WITH_CONFIRM = [
  ...DOCUMENT_KINDS,
  "confirm_destination",
] as const;

export const COMMS_CHANNELS = ["whatsapp", "email", "sms"] as const;

// ---------- primitive shapes ----------

// Single required `case_id` — by far the most common input shape.
export const caseIdInput = (extraDescription?: string) => ({
  type: "object" as const,
  properties: { case_id: { type: "string" as const } },
  required: ["case_id"],
  ...(extraDescription ? { description: extraDescription } : {}),
});

// ---------- shared tools ----------

export const askUserForInputTool: AgentTool = {
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

export const acknowledgeAndWaitTool: AgentTool = {
  name: "acknowledge_and_wait",
  description:
    "Terminal: yield the loop without dispatch. Use when no further action is needed this turn.",
  input_schema: {
    type: "object",
    properties: { reason: { type: "string" } },
    required: ["reason"],
  },
};

// `request_document` has two variants:
//   - "internal" form (intake, compliance, specialist) — just the kind.
//   - "outbound" form (comms) — adds case_id + channel because comms owns delivery.
export const requestDocumentInternalTool: AgentTool = {
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

export const requestDocumentSpecialistTool: AgentTool = {
  ...requestDocumentInternalTool,
  input_schema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: [...DOCUMENT_KINDS_WITH_CONFIRM] },
    },
    required: ["kind"],
  },
};

export const requestDocumentOutboundTool: AgentTool = {
  name: "request_document",
  description:
    "Terminal: send the owner a templated request for a specific document type.",
  input_schema: {
    type: "object",
    properties: {
      case_id: { type: "string" },
      channel: { type: "string", enum: ["whatsapp", "email"] },
      kind: { type: "string", enum: [...DOCUMENT_KINDS] },
    },
    required: ["case_id", "channel", "kind"],
  },
};
