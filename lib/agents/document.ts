// Document — native vision extraction over uploaded artifacts.
// Wraps lib/document-extract.ts as a tool-use loop so the orchestrator can
// dispatch it like any other agent, with structured emit_extraction output.

import { type AgentDefinition, validateAgent } from "./types";
import { CASE_ID_INPUT } from "./shared-tools";

export const DOCUMENT: AgentDefinition = validateAgent({
  name: "document",
  type: "document",
  model: "claude-sonnet-4-6",
  user_facing_label: "Document Team",
  description:
    "Native vision extraction. Reads uploaded rabies certificates, microchip records, permits — emits structured fields with confidence.",
  prompt_path: "lib/prompts/document.md",
  tools: [
    {
      name: "read_document_blob",
      description: "Read the binary content of an uploaded document by id (returns a base64 reference and mime type).",
      input_schema: {
        type: "object",
        properties: { document_id: { type: "string" } },
        required: ["document_id"],
      },
    },
    {
      name: "read_pet_facts",
      description: "Read the case's pet row so you can flag mismatches between the document and the existing record.",
      input_schema: CASE_ID_INPUT,
    },
    {
      name: "emit_extraction",
      description:
        "Terminal: write the structured extraction. `confidence` must reflect document legibility, not your faith in the model. Hand-written or partially obscured documents cap at 0.9.",
      input_schema: {
        type: "object",
        properties: {
          document_id: { type: "string" },
          classification: {
            type: "string",
            enum: [
              "rabies_certificate",
              "microchip_record",
              "health_certificate",
              "import_permit",
              "export_permit",
              "vet_invoice",
              "passport_id_page",
              "pet_photo",
              "unknown",
            ],
          },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          extracted_fields: {
            type: "object",
            description: "Structured fields per the schema in the prompt. Use null for absent or illegible values.",
          },
          mismatch_with_pet: {
            type: "array",
            items: { type: "string" },
            description: "Fields that disagree with the existing pet row (e.g. microchip_id, date_of_birth).",
          },
        },
        required: ["document_id", "classification", "confidence", "extracted_fields"],
      },
    },
    {
      name: "fail_extraction",
      description: "Terminal: abort. Use when the document is illegible, password-protected, or not a pet-relocation artifact.",
      input_schema: {
        type: "object",
        properties: {
          document_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["document_id", "reason"],
      },
    },
  ],
  terminal_tools: ["emit_extraction", "fail_extraction"],
  budget: { max_turns: 3, max_input_tokens: 40_000 },
});
