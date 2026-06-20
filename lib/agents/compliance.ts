// Compliance (Primary) — reasons over case + rule graph and emits an assessment.

import { type AgentDefinition, type AgentTool, validateAgent } from "./types";

export const COMPLIANCE_ASSESSMENT_TOOL: AgentTool = {
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

export const COMPLIANCE_SHARED_READ_TOOLS: AgentTool[] = [
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
];

export const COMPLIANCE: AgentDefinition = validateAgent({
  name: "compliance",
  type: "compliance",
  model: "claude-sonnet-4-6",
  user_facing_label: "Compliance Team",
  description:
    "Primary compliance voice. Reasons over case data + country rules; emits an assessment with citations and missing requirements.",
  prompt_path: "lib/prompts/compliance.md",
  tools: [
    ...COMPLIANCE_SHARED_READ_TOOLS,
    COMPLIANCE_ASSESSMENT_TOOL,
    {
      name: "request_document",
      description: "Terminal: ask the owner via Comms for a missing document.",
      input_schema: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["rabies", "microchip", "passport", "vet_records", "import_permit", "endorsement"],
          },
        },
        required: ["kind"],
      },
    },
    {
      name: "ask_user_for_input",
      description: "Terminal: ask the owner via Comms for a missing fact (e.g. microchip date).",
      input_schema: {
        type: "object",
        properties: {
          field: { type: "string" },
          question: { type: "string" },
        },
        required: ["field", "question"],
      },
    },
  ],
  terminal_tools: ["emit_assessment", "request_document", "ask_user_for_input"],
  budget: { max_turns: 8, max_input_tokens: 60_000 },
});
