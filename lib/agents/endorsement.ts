// Endorsement — the 10-day window timing, MOCCAE/APHA submission, courier
// tracking. Participates in the consensus timeline loop (AGENT.md §2.2) by
// proposing the endorsement appointment date relative to the locked flight
// window. The endorsement window (7–10 days pre-flight) is the tightest
// constraint in the loop, so this agent often drives the resolution.

import { type AgentDefinition, validateAgent, READ_CASE_TOOL, DATE_WINDOW_PROPERTIES } from "./types";

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Enforces the 10-day endorsement window. Schedules MOCCAE/APHA submission, tracks the courier, hands the document to the airline.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    READ_CASE_TOOL,
    {
      name: "read_documents",
      description: "Read all documents linked to a case (with extracted_fields and verification status).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "compute_endorsement_window",
      description:
        "Deterministic: given a flight date and destination authority, return the legal endorsement appointment window. Authoritative — do not compute dates yourself.",
      input_schema: {
        type: "object",
        properties: {
          flight_date: { type: "string", description: "ISO YYYY-MM-DD." },
          authority: { type: "string", enum: ["MOCCAE", "APHA", "USDA", "CFIA", "DAFF", "OTHER"] },
        },
        required: ["flight_date", "authority"],
      },
    },
    {
      name: "propose_endorsement_appointment",
      description:
        "Terminal: propose the endorsement vet appointment for the consensus timeline round. The window must come from compute_endorsement_window; do not invent dates.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: ["MOCCAE", "APHA", "USDA", "CFIA", "DAFF", "OTHER"] },
          ...DATE_WINDOW_PROPERTIES,
          rationale: { type: "string", description: "Cite compute_endorsement_window result and the locked flight date." },
        },
        required: ["case_id", "authority", "earliest_date", "latest_date", "preferred_date", "rationale"],
      },
    },
    {
      name: "submit_endorsement",
      description:
        "Terminal: submit the signed health certificate to the destination authority's portal. Use ONLY when the orchestrator has locked the endorsement date and the signed certificate is on file.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: ["MOCCAE", "APHA", "USDA", "CFIA", "DAFF", "OTHER"] },
          health_certificate_document_id: { type: "string" },
        },
        required: ["case_id", "authority", "health_certificate_document_id"],
      },
    },
    {
      name: "track_courier",
      description:
        "Terminal: register a courier AWB and start tracking the endorsement document on its way to the airport.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          courier: { type: "string", enum: ["DHL", "FedEx", "Aramex", "DTDC", "OTHER"] },
          awb: { type: "string", description: "Air waybill / tracking number." },
        },
        required: ["case_id", "courier", "awb"],
      },
    },
    {
      name: "flag_endorsement_blocker",
      description:
        "Terminal: an endorsement step is blocked (authority closed for window, document rejected, courier failed). Hand to a human.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          blocker: { type: "string", enum: ["window_unreachable", "document_rejected", "courier_failed", "authority_closed", "other"] },
          detail: { type: "string" },
        },
        required: ["case_id", "blocker", "detail"],
      },
    },
  ],
  terminal_tools: [
    "propose_endorsement_appointment",
    "submit_endorsement",
    "track_courier",
    "flag_endorsement_blocker",
  ],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
