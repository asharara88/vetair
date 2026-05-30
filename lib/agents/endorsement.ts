// Endorsement — drives the wet-signed pre-export endorsement packet through
// MOCCAE (UAE) or APHA (UK) inside the 10-day pre-flight window, then tracks
// the courier hand-off to the airline gateway.

import { type AgentDefinition, validateAgent } from "./types";
import { ACKNOWLEDGE_AND_WAIT_TOOL } from "./shared-tools";

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement Team",
  description:
    "Schedules the MOCCAE / APHA endorsement inside the 10-day pre-flight window and tracks courier handover of the wet-signed packet.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_case_facts",
      description: "Read case + pet + locked flight date so the window can be computed.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_endorsement_window",
      description:
        "Deterministic: returns the legal endorsement window for this corridor (typically 7-10 days pre-flight) as { window_start, window_end, authority } based on the locked flight date.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_packet_documents",
      description:
        "Read the documents that must be in the packet (health certificate, rabies certificate, microchip record, import permit). Returns the document set and any missing types.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "submit_to_authority",
      description:
        "Terminal: file the packet with the issuing authority. Writes an endorsement_submissions row with status='submitted' and the authority reference number. The orchestrator will trigger Comms to notify the owner.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: ["MOCCAE", "APHA", "USDA", "DEFRA"] },
          appointment_at: { type: "string", description: "ISO datetime of the endorsement appointment." },
          packet_document_ids: { type: "array", items: { type: "string" }, minItems: 1 },
          notes: { type: "string" },
        },
        required: ["case_id", "authority", "appointment_at", "packet_document_ids"],
      },
    },
    {
      name: "request_courier_pickup",
      description:
        "Terminal: book a courier to collect the wet-signed packet from the authority and deliver to the airline gateway. Writes courier_jobs row.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          submission_id: { type: "string" },
          courier: { type: "string", enum: ["aramex", "dhl", "fedex"] },
          pickup_at: { type: "string", description: "ISO datetime." },
          deliver_to_iata: { type: "string", description: "Airport gateway IATA code." },
        },
        required: ["case_id", "submission_id", "courier", "pickup_at", "deliver_to_iata"],
      },
    },
    {
      name: "packet_incomplete",
      description:
        "Terminal: cannot submit — packet is missing required documents. Hand back so the orchestrator can re-dispatch document collection.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          missing: { type: "array", items: { type: "string" }, minItems: 1 },
        },
        required: ["case_id", "missing"],
      },
    },
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: ["submit_to_authority", "request_courier_pickup", "packet_incomplete", "acknowledge_and_wait"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
