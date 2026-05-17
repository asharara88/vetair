// Reusable Anthropic tool definitions shared across multiple agents.
// Keeping these single-source eliminates the enum drift between intake,
// compliance, comms, and specialist that crept in across Sessions 4–7.

import type { AgentTool } from "./types";

// All document kinds the case-side agents may request from the owner.
// Specialist adds `confirm_destination` for its abort path; everyone else
// reads from this list directly.
export const OWNER_DOCUMENT_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
  "import_permit",
  "endorsement",
] as const;
export type OwnerDocumentKind = (typeof OWNER_DOCUMENT_KINDS)[number];

// Intake captures a narrower kit; permits/endorsements are pulled forward
// by Compliance later in the loop.
export const INTAKE_DOCUMENT_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
] as const;

// Specialist's superset — adds the destination-mismatch escape hatch.
export const SPECIALIST_DOCUMENT_KINDS = [
  ...OWNER_DOCUMENT_KINDS,
  "confirm_destination",
] as const;

// ---------- shared terminal tools ----------

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

export const ACKNOWLEDGE_AND_WAIT_TOOL: AgentTool = {
  name: "acknowledge_and_wait",
  description: "Terminal: yield the loop without dispatch (e.g. waiting on owner reply or an external action).",
  input_schema: {
    type: "object",
    properties: { reason: { type: "string" } },
    required: ["reason"],
  },
};

// ---------- request_document factory ----------
// Two shapes exist in the system:
//   • owner-facing: just `kind` — the active thread is implied by case context
//   • comms-relay: `case_id` + `channel` + `kind` — Comms picks the channel
// Both go through the same factory so the schema stays consistent.

export function makeOwnerRequestDocumentTool(
  kinds: readonly string[],
  description = "Ask the owner to upload a specific document type.",
): AgentTool {
  return {
    name: "request_document",
    description,
    input_schema: {
      type: "object",
      properties: { kind: { type: "string", enum: [...kinds] } },
      required: ["kind"],
    },
  };
}

export function makeCommsRequestDocumentTool(
  kinds: readonly string[],
  description = "Terminal: send the owner a templated request for a specific document type.",
): AgentTool {
  return {
    name: "request_document",
    description,
    input_schema: {
      type: "object",
      properties: {
        case_id: { type: "string" },
        channel: { type: "string", enum: ["whatsapp", "email"] },
        kind: { type: "string", enum: [...kinds] },
      },
      required: ["case_id", "channel", "kind"],
    },
  };
}

// ---------- shared case-context readers ----------

export const READ_CASE_TOOL: AgentTool = {
  name: "read_case",
  description: "Read a case row by id, including state, corridor, target_date, and budget counters.",
  input_schema: {
    type: "object",
    properties: { case_id: { type: "string" } },
    required: ["case_id"],
  },
};

export const READ_PET_FACTS_TOOL: AgentTool = {
  name: "read_pet_facts",
  description: "Read the case's pet row (species, breed, weight, microchip).",
  input_schema: {
    type: "object",
    properties: { case_id: { type: "string" } },
    required: ["case_id"],
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

export const READ_ASSESSMENT_TOOL: AgentTool = {
  name: "read_assessment",
  description: "Read the most recent compliance assessment for a case (verdict, summary, cited_rules, requirements_missing).",
  input_schema: {
    type: "object",
    properties: { case_id: { type: "string" } },
    required: ["case_id"],
  },
};
