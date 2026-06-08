// Endorsement — owns the pre-flight authority submission window.

import { type AgentDefinition, validateAgent } from "./types";

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Submits the signed health certificate inside the authority's pre-flight window (MOCCAE / APHA / APHIS), tracks the courier, and either releases the case to transit or blocks departure on a missing stamp.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_signed_certificate",
      description: "Read the OV-signed health certificate document for a case. Returns null if not yet uploaded.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "check_window",
      description:
        "Compute the authority's submission window relative to flight departure.",
      input_schema: {
        type: "object",
        properties: {
          flight_dep_iso: { type: "string", description: "ISO timestamp" },
          authority: {
            type: "string",
            enum: ["moccae", "apha", "aphis", "cfia", "daff"],
          },
        },
        required: ["flight_dep_iso", "authority"],
      },
    },
    {
      name: "submit_to_authority",
      description: "Submit the signed certificate to the destination authority via the chosen courier.",
      input_schema: {
        type: "object",
        properties: {
          authority: {
            type: "string",
            enum: ["moccae", "apha", "aphis", "cfia", "daff"],
          },
          certificate_document_id: { type: "string" },
          courier: { type: "string", enum: ["dhl", "fedex", "aramex", "in_person"] },
        },
        required: ["authority", "certificate_document_id", "courier"],
      },
    },
    {
      name: "track_courier",
      description: "Look up live courier status for a prior submission.",
      input_schema: {
        type: "object",
        properties: { submission_id: { type: "string" } },
        required: ["submission_id"],
      },
    },
    {
      name: "emit_endorsement_status",
      description:
        "Terminal: record the current endorsement status. Cited requirement_codes must appear in {{country_rules}}.",
      input_schema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["submitted", "stamped", "rejected"] },
          submission_id: { type: "string" },
          requirement_codes: { type: "array", items: { type: "string" } },
          notes: { type: "string" },
        },
        required: ["status", "submission_id", "requirement_codes"],
      },
    },
    {
      name: "block_departure",
      description:
        "Terminal: hold the case from transit. Use on rejection or missing signed certificate.",
      input_schema: {
        type: "object",
        properties: {
          reason: { type: "string" },
          missing_requirement_code: { type: "string" },
        },
        required: ["reason", "missing_requirement_code"],
      },
    },
    {
      name: "escalate_to_human",
      description: "Terminal: hand off to the operator (e.g. courier delay inside 48h of flight).",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: ["emit_endorsement_status", "block_departure", "escalate_to_human"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
