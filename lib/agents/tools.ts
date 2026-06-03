// Shared tool building blocks. Lives outside any single agent file so that
// e.g. auditor + specialist don't need to import from compliance just to grab
// a `read_country_rules` schema.

import type { AgentTool } from "./types";

// Document kinds the owner can be asked to upload. Adding a kind here makes it
// available to every agent that requests documents.
export const DOCUMENT_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
  "import_permit",
  "endorsement",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

// ---------------- compliance read surface ----------------
// Used by Compliance, Auditor, and synthesized country specialists. They all
// reason over the same case + rules + documents view.

export const READ_COUNTRY_RULES: AgentTool = {
  name: "read_country_rules",
  description: "Read the country_rules table filtered by corridor + species.",
  input_schema: {
    type: "object",
    properties: {
      origin: { type: "string" },
      destination: { type: "string" },
      species: { type: "string" },
    },
    required: ["origin", "destination", "species"],
  },
};

export const READ_DOCUMENTS: AgentTool = {
  name: "read_documents",
  description: "Read all documents linked to a case (with extracted_fields).",
  input_schema: {
    type: "object",
    properties: { case_id: { type: "string" } },
    required: ["case_id"],
  },
};

export const RUN_DETERMINISTIC: AgentTool = {
  name: "run_deterministic",
  description:
    "Run the deterministic TS evaluator for a single requirement_code. Authoritative on facts.",
  input_schema: {
    type: "object",
    properties: { rule_code: { type: "string" } },
    required: ["rule_code"],
  },
};

export const COMPLIANCE_READ_TOOLS: readonly AgentTool[] = [
  READ_COUNTRY_RULES,
  READ_DOCUMENTS,
  RUN_DETERMINISTIC,
];

// ---------------- compliance terminal ----------------

export const EMIT_ASSESSMENT: AgentTool = {
  name: "emit_assessment",
  description:
    "Terminal: write the compliance assessment for this case. Every requirements_missing entry must cite a requirement_code from {{country_rules}}.",
  input_schema: {
    type: "object",
    properties: {
      verdict: { type: "string", enum: ["approved", "blocked", "pending"] },
      summary: { type: "string" },
      cited_rules: { type: "array", items: { type: "string" } },
      requirements_missing: {
        type: "array",
        items: {
          type: "object",
          properties: {
            requirement_code: { type: "string" },
            what_needed: { type: "string" },
            blocking: { type: "boolean" },
          },
          required: ["requirement_code", "what_needed"],
        },
      },
    },
    required: ["verdict", "summary", "cited_rules", "requirements_missing"],
  },
};

// ---------------- terminal helpers shared across agents ----------------

/**
 * Templated `request_document` terminal. Variants:
 *  - simple: only `{ kind }`. Used by Intake, Compliance, Specialist — all
 *    rely on the orchestrator to route the message to Comms.
 *  - channeled: `{ case_id, channel, kind }`. Used by Comms itself, which
 *    sends the outbound message directly.
 */
export function requestDocumentTool(
  variant: "simple" | "channeled" = "simple",
  extraKinds: readonly string[] = [],
): AgentTool {
  const kinds = [...DOCUMENT_KINDS, ...extraKinds];
  if (variant === "channeled") {
    return {
      name: "request_document",
      description: "Terminal: send the owner a templated request for a specific document type.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          channel: { type: "string", enum: ["whatsapp", "email"] },
          kind: { type: "string", enum: kinds },
        },
        required: ["case_id", "channel", "kind"],
      },
    };
  }
  return {
    name: "request_document",
    description: "Terminal: ask the owner via Comms for a missing document.",
    input_schema: {
      type: "object",
      properties: { kind: { type: "string", enum: kinds } },
      required: ["kind"],
    },
  };
}

export const ASK_USER_FOR_INPUT: AgentTool = {
  name: "ask_user_for_input",
  description: "Terminal: ask the owner via Comms for a missing fact.",
  input_schema: {
    type: "object",
    properties: {
      field: { type: "string" },
      question: { type: "string" },
    },
    required: ["field", "question"],
  },
};

export const ACKNOWLEDGE_AND_WAIT: AgentTool = {
  name: "acknowledge_and_wait",
  description: "Terminal: yield the loop without dispatch (e.g. waiting on owner reply).",
  input_schema: {
    type: "object",
    properties: { reason: { type: "string" } },
    required: ["reason"],
  },
};
