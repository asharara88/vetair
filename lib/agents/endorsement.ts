// Endorsement — owns the 7–10 day pre-flight endorsement window.
// MOCCAE (UAE export) / APHA (UK) / USDA submission, courier tracking,
// and consensus-timeline proposals for the endorsement appointment.

import { type AgentDefinition, validateAgent } from "./types";
import { readCaseTool } from "./tools";

const AUTHORITY_ENUM = ["MOCCAE", "APHA", "USDA", "OTHER"] as const;

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Owns the 7–10 day pre-flight endorsement window. Submits the health certificate to MOCCAE/APHA/USDA, tracks the courier, and proposes the endorsement appointment in the consensus timeline.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    readCaseTool(),
    {
      name: "read_documents",
      description: "Read all documents linked to the case (with extracted_fields).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "compute_endorsement_window",
      description:
        "Given the flight departure date, return the legal endorsement appointment window (`window_open`/`window_close` ISO dates) per the destination authority.",
      input_schema: {
        type: "object",
        properties: {
          authority: { type: "string", enum: [...AUTHORITY_ENUM] },
          departure_date: { type: "string", description: "ISO YYYY-MM-DD" },
        },
        required: ["authority", "departure_date"],
      },
    },
    {
      name: "propose_endorsement_appointment",
      description:
        "Propose an endorsement appointment date for the consensus timeline. Must fall inside the computed window AND after the OV health certificate is signed.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: [...AUTHORITY_ENUM] },
          proposed_date: { type: "string" },
          window_open: { type: "string" },
          window_close: { type: "string" },
          rationale: { type: "string" },
        },
        required: ["case_id", "authority", "proposed_date", "window_open", "window_close"],
      },
    },
    {
      name: "submit_endorsement",
      description:
        "Terminal: file the signed health certificate with the authority and dispatch the courier. Returns submission_id + courier tracking number.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: [...AUTHORITY_ENUM] },
          health_cert_document_id: { type: "string" },
          appointment_date: { type: "string" },
          courier: { type: "string", description: "e.g. DHL, FedEx, in-person" },
        },
        required: ["case_id", "authority", "health_cert_document_id", "appointment_date"],
      },
    },
    {
      name: "flag_window_conflict",
      description:
        "Terminal: the endorsement window does not fit the current target_date / vet appointment. Orchestrator must re-plan.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          conflict: { type: "string" },
          earliest_workable_departure: { type: "string" },
        },
        required: ["case_id", "conflict", "earliest_workable_departure"],
      },
    },
    {
      name: "request_health_certificate",
      description:
        "Terminal: ask the Vet Network agent to produce/upload the OV-signed health certificate so endorsement can proceed.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          required_by: { type: "string", description: "ISO date the cert must be signed by" },
        },
        required: ["case_id", "required_by"],
      },
    },
  ],
  terminal_tools: ["submit_endorsement", "flag_window_conflict", "request_health_certificate"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
