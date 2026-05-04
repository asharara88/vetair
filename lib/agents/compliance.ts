// Compliance (Primary) — reasons over case + rule graph and emits an assessment.

import { type AgentDefinition, type AgentTool, validateAgent } from "./types";
import {
  ASK_USER_FOR_INPUT_TOOL,
  CASE_ID_INPUT,
  DOCUMENT_KINDS,
  requestDocumentTool,
} from "./shared-tools";

const ASSESSMENT_TOOL: AgentTool = {
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

const SHARED_READ_TOOLS: AgentTool[] = [
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
    input_schema: CASE_ID_INPUT,
  },
  {
    name: "run_deterministic",
    description: "Run the deterministic TS evaluator for a single requirement_code. Authoritative on facts.",
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
    ...SHARED_READ_TOOLS,
    ASSESSMENT_TOOL,
    requestDocumentTool({ kinds: DOCUMENT_KINDS }),
    ASK_USER_FOR_INPUT_TOOL,
  ],
  terminal_tools: ["emit_assessment", "request_document", "ask_user_for_input"],
  budget: { max_turns: 8, max_input_tokens: 60_000 },
});

export const COMPLIANCE_SHARED_READ_TOOLS = SHARED_READ_TOOLS;
export const COMPLIANCE_ASSESSMENT_TOOL = ASSESSMENT_TOOL;
