// Endorsement — coordinates the government endorsement step (USDA-APHIS, DEFRA,
// MOCCAE, etc). Submits the signed health certificate to the authority, polls
// status, and surfaces the endorsed PDF back into the case documents table.

import { type AgentDefinition, validateAgent } from "./types";
import { ACKNOWLEDGE_AND_WAIT_TOOL, READ_CASE_TOOL } from "./shared";

const ENDORSEMENT_AUTHORITIES = ["USDA-APHIS", "DEFRA", "MOCCAE", "AGRICANADA", "CFIA", "OTHER"] as const;

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-haiku-4-5",
  user_facing_label: "Endorsement Desk",
  description:
    "Submits the signed health certificate to the destination's endorsement authority and tracks its return. Surfaces the endorsed PDF back into the case once the authority signs.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    READ_CASE_TOOL,
    {
      name: "read_documents",
      description: "Read all documents linked to a case. Used to locate the unsigned health certificate.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_endorsement_status",
      description:
        "Read the endorsement_submissions row for this case (if any). Returns null on first run; otherwise returns submission state, authority reference, ETA.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "submit_to_authority",
      description:
        "Terminal: submit the signed health certificate to the endorsement authority. Idempotent: a duplicate submission for the same case+document_id is rejected at the DB level.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          document_id: {
            type: "string",
            description: "ID of the signed health_certificate document to forward.",
          },
          authority: { type: "string", enum: [...ENDORSEMENT_AUTHORITIES] },
        },
        required: ["case_id", "document_id", "authority"],
      },
    },
    {
      name: "record_endorsement",
      description:
        "Terminal: persist the endorsed certificate returned by the authority. Stamps the original document as endorsed_by/endorsed_at and links the new endorsed PDF.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          submission_id: { type: "string" },
          endorsed_document_id: { type: "string" },
          endorsed_at: { type: "string", description: "ISO-8601 datetime stamped by the authority." },
        },
        required: ["case_id", "submission_id", "endorsed_document_id", "endorsed_at"],
      },
    },
    {
      name: "fail_endorsement",
      description:
        "Terminal: abort. Use when the authority rejects the submission outright (wrong document, invalid vet license).",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: [
    "submit_to_authority",
    "record_endorsement",
    "fail_endorsement",
    "acknowledge_and_wait",
  ],
  budget: { max_turns: 5, max_input_tokens: 40_000 },
});

export const ENDORSEMENT_AUTHORITY_LIST = ENDORSEMENT_AUTHORITIES;
