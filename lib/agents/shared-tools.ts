// Shared tool manifests reused across multiple agent definitions.
// Lives outside any single agent so siblings don't have to cross-import each
// other's internals (compliance + auditor + specialist all share the read set;
// compliance + specialist share the assessment terminal).

import type { AgentTool } from "./types";

/** Country-rule + document + deterministic reads. Used by every compliance-family agent. */
export const COMPLIANCE_READ_TOOLS: readonly AgentTool[] = [
  {
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
  },
  {
    name: "read_documents",
    description: "Read all documents linked to a case (with extracted_fields).",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  },
  {
    name: "run_deterministic",
    description:
      "Run the deterministic TS evaluator for a single requirement_code. Authoritative on facts.",
    input_schema: {
      type: "object",
      properties: { rule_code: { type: "string" } },
      required: ["rule_code"],
    },
  },
] as const;

/** Terminal: write the compliance assessment. Used by primary compliance and specialists. */
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

/** Standard document-kind enum reused by request_document tools across agents. */
export const DOCUMENT_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
  "import_permit",
  "endorsement",
] as const;
