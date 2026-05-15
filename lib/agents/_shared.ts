// Shared tool manifests reused across compliance-family agents.
// The primary compliance loop, the adversarial auditor, and every
// runtime-synthesized specialist all read the same rule + document
// surface and emit the same assessment shape. Centralizing those
// declarations here keeps the family in sync and avoids cross-imports
// between sibling agent modules.

import type { AgentTool } from "./types";

export const READ_COUNTRY_RULES_TOOL: AgentTool = {
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

export const READ_DOCUMENTS_TOOL: AgentTool = {
  name: "read_documents",
  description: "Read all documents linked to a case (with extracted_fields).",
  input_schema: {
    type: "object",
    properties: { case_id: { type: "string" } },
    required: ["case_id"],
  },
};

export const RUN_DETERMINISTIC_TOOL: AgentTool = {
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
  READ_COUNTRY_RULES_TOOL,
  READ_DOCUMENTS_TOOL,
  RUN_DETERMINISTIC_TOOL,
];

export const EMIT_ASSESSMENT_TOOL: AgentTool = {
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

// Document kinds the owner can be asked to upload. Single source of truth.
export const DOCUMENT_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
  "import_permit",
  "endorsement",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
