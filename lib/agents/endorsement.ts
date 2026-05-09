// Endorsement — runs the destination-specific endorsement window
// (USDA APHIS, MOCCAE, AVA, DEFRA, etc.) and tracks the courier handoff
// so the validated certificate lands inside the airline's acceptance window.

import { type AgentDefinition, validateAgent } from "./types";

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Runs the destination endorsement window (USDA APHIS / MOCCAE / DEFRA, etc.) and tracks the courier handoff so the certificate lands inside the airline acceptance window.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_assessment",
      description: "Read the most recent compliance assessment to identify the endorsement requirement_code(s).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_documents",
      description: "Read all uploaded documents for the case — the issued health certificate must be on file before endorsement can be submitted.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "compute_endorsement_window",
      description:
        "Given the flight date and country rule, compute the legal endorsement window (earliest_submit_at, latest_submit_at, certificate_valid_until).",
      input_schema: {
        type: "object",
        properties: {
          destination_country: { type: "string" },
          flight_depart_at: { type: "string", description: "ISO-8601 timestamp." },
          requirement_code: { type: "string" },
        },
        required: ["destination_country", "flight_depart_at", "requirement_code"],
      },
    },
    {
      name: "submit_endorsement",
      description:
        "Submit the issued health certificate to the destination authority (USDA APHIS / MOCCAE / etc.). Requires the certificate document_id and the chosen submission slot.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: {
            type: "string",
            enum: ["USDA_APHIS", "MOCCAE", "DEFRA", "AVA", "CFIA", "MAFF", "OTHER"],
          },
          certificate_document_id: { type: "string" },
          submitted_at: { type: "string", description: "ISO-8601 timestamp inside the legal window." },
          requirement_code: { type: "string" },
        },
        required: ["case_id", "authority", "certificate_document_id", "submitted_at", "requirement_code"],
      },
    },
    {
      name: "schedule_courier",
      description:
        "Book the courier handoff that returns the endorsed certificate to the owner before the airline cutoff. The pickup must be after the endorsement appointment and the delivery before flight check-in.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          courier: { type: "string", enum: ["FedEx", "DHL", "UPS", "Aramex", "in_person", "OTHER"] },
          pickup_at: { type: "string", description: "ISO-8601." },
          deliver_by: { type: "string", description: "ISO-8601." },
          tracking_number: { type: "string" },
        },
        required: ["case_id", "courier", "pickup_at", "deliver_by"],
      },
    },
    {
      name: "endorsement_complete",
      description:
        "Terminal: the endorsed certificate is in the owner's hand and the airline cutoff has not passed. Mark the requirement satisfied with the citation that backs it.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          requirement_code: { type: "string" },
          certificate_document_id: { type: "string" },
          valid_until: { type: "string", description: "ISO-8601 timestamp the certificate expires." },
        },
        required: ["case_id", "requirement_code", "certificate_document_id", "valid_until"],
      },
    },
    {
      name: "endorsement_blocked",
      description:
        "Terminal: the endorsement cannot be completed in time (window missed, authority rejection, document deficiency). Returns the rejection reason and any new earliest_legal_date.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_legal_date: { type: "string", description: "ISO-8601 date the endorsement could be retried." },
          cited_rules: { type: "array", items: { type: "string" }, minItems: 1 },
        },
        required: ["case_id", "reason", "cited_rules"],
      },
    },
  ],
  terminal_tools: ["endorsement_complete", "endorsement_blocked"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
