// Endorsement — drives the OV-stamped health certificate through the 10-day
// pre-flight window: schedules the appointment, prepares the submission
// package for the national authority (MOCCAE / APHA / equivalent), and
// tracks courier delivery of the endorsed paperwork to the airport.

import { type AgentDefinition, validateAgent } from "./types";

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement Team",
  description:
    "Drives the pre-flight endorsement: 10-day window timing, MOCCAE/APHA submission package, courier tracking of the stamped certificate.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_case_timeline",
      description: "Read the flight date, OV appointment slot, and the authority that endorses for this corridor.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_documents",
      description: "Read the case's documents to confirm the OV-issued health certificate is uploaded before submission.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "submit_to_authority",
      description:
        "Non-terminal: build the submission package (form fields + attached documents) and post it to the destination authority's portal. The portal returns a tracking number.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: ["MOCCAE", "APHA", "USDA_VS", "OTHER"] },
          form_fields: { type: "object" },
          attached_document_ids: { type: "array", items: { type: "string" } },
        },
        required: ["case_id", "authority", "form_fields", "attached_document_ids"],
      },
    },
    {
      name: "track_courier",
      description:
        "Non-terminal: poll the courier's tracking endpoint for the endorsed document's return shipment.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          courier: { type: "string", enum: ["DHL", "FedEx", "Aramex", "Local"] },
          tracking_number: { type: "string" },
        },
        required: ["case_id", "courier", "tracking_number"],
      },
    },
    {
      name: "emit_endorsement_complete",
      description:
        "Terminal: endorsement is stamped, returned, and in the owner's possession (or staged at the cargo facility). The case is ready for booking confirmation.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          endorsed_document_id: { type: "string" },
          endorsed_at: { type: "string", description: "ISO datetime the authority stamped." },
          authority: { type: "string" },
        },
        required: ["case_id", "endorsed_document_id", "endorsed_at", "authority"],
      },
    },
    {
      name: "request_document",
      description: "Terminal: ask the owner via Comms for a prerequisite document (e.g. OV-signed health certificate) before submission can proceed.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          kind: { type: "string", enum: ["health_certificate", "rabies", "import_permit", "endorsement"] },
        },
        required: ["case_id", "kind"],
      },
    },
    {
      name: "escalate_window_breach",
      description:
        "Terminal: the endorsement window has been missed (flight ≤ 24h away and stamped paperwork has not returned). The orchestrator escalates to human break-glass.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: ["emit_endorsement_complete", "request_document", "escalate_window_breach"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
