// Endorsement — 10-day pre-flight window timing, MOCCAE / APHA submission,
// courier tracking. Closes the loop on the consensus timeline: vet_network
// books the endorsement vet appointment, this agent handles the paperwork
// that comes out of it.

import { type AgentDefinition, validateAgent } from "./types";

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Computes the 10-day pre-flight endorsement window, submits the packet to MOCCAE / APHA, tracks the courier, and closes the loop when the endorsed cert is back in hand.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_endorsement_window",
      description:
        "Compute the legal endorsement window for this case: 7–10 days before the proposed travel_date. Returns { window_start, window_end } as ISO dates.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_endorsement_packet",
      description:
        "Read the document set needed for endorsement (health cert, rabies record, titer, microchip, import permit). Returns each document's id, classification, and extracted_fields.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "submit_endorsement",
      description:
        "Submit the packet to the destination authority. UAE-bound uses MOCCAE; UK / EU-bound uses APHA. Returns submission_id + estimated turnaround.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: ["MOCCAE", "APHA", "USDA_APHIS"] },
          document_ids: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            description: "Document ids included in the submitted packet",
          },
        },
        required: ["case_id", "authority", "document_ids"],
      },
    },
    {
      name: "track_courier",
      description: "Poll the courier for the latest tracking status of a submission's return shipment.",
      input_schema: {
        type: "object",
        properties: { tracking_id: { type: "string" } },
        required: ["tracking_id"],
      },
    },
    {
      name: "confirm_endorsement_complete",
      description:
        "Terminal: the endorsed certificate is uploaded and verified. Hands the case back to the orchestrator for booking confirmation.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          endorsed_document_id: { type: "string" },
        },
        required: ["case_id", "endorsed_document_id"],
      },
    },
    {
      name: "flag_courier_delay",
      description:
        "Terminal: courier is past its SLA. Orchestrator decides whether to escalate or push the travel_date.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          tracking_id: { type: "string" },
          delay_hours: { type: "integer", minimum: 1 },
          reason: { type: "string" },
        },
        required: ["case_id", "tracking_id", "delay_hours", "reason"],
      },
    },
    {
      name: "request_document",
      description:
        "Terminal: ask the owner via Comms for a missing artifact (e.g. import permit not yet uploaded).",
      input_schema: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["import_permit", "health_certificate", "rabies", "titer", "microchip"],
          },
        },
        required: ["kind"],
      },
    },
  ],
  terminal_tools: ["confirm_endorsement_complete", "flag_courier_delay", "request_document"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
