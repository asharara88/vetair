// Endorsement — handles the 7–10 day pre-flight endorsement window with the
// destination authority (MOCCAE for UAE, APHA for UK, USDA-APHIS for US, etc.).
// Submits the packet, tracks the courier, and proposes dates into the consensus loop.

import { type AgentDefinition, validateAgent } from "./types";
import {
  PROPOSE_DATES_TOOL,
  READ_ASSESSMENT_TOOL,
} from "./shared-tools";

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Manages the 7–10 day pre-flight endorsement window with the destination authority (MOCCAE, APHA, USDA-APHIS). Submits the packet and tracks the courier.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    READ_ASSESSMENT_TOOL,
    {
      name: "compute_endorsement_window",
      description:
        "Given the proposed flight date, return the earliest + latest valid endorsement signoff dates per the destination's pre-flight window.",
      input_schema: {
        type: "object",
        properties: {
          destination: { type: "string" },
          flight_date: { type: "string", description: "ISO YYYY-MM-DD" },
        },
        required: ["destination", "flight_date"],
      },
    },
    {
      name: "read_documents",
      description:
        "Read all documents on the case so you can confirm the endorsement packet is complete (rabies cert, microchip record, health cert, titer results if applicable, import permit).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    PROPOSE_DATES_TOOL,
    {
      name: "submit_packet",
      description:
        "Terminal: submit the endorsement packet to the destination authority. Returns a tracking id.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: {
            type: "string",
            enum: ["MOCCAE", "APHA", "USDA-APHIS", "CFIA", "AQIS", "MAFF", "DAFM", "OTHER"],
          },
          packet_document_ids: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            description: "documents.id of every artifact in the submitted packet.",
          },
        },
        required: ["case_id", "authority", "packet_document_ids"],
      },
    },
    {
      name: "track_endorsement",
      description: "Terminal: poll courier / authority status for an in-flight endorsement.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          tracking_id: { type: "string" },
        },
        required: ["case_id", "tracking_id"],
      },
    },
    {
      name: "escalate_window_missed",
      description:
        "Terminal: the endorsement window has closed (or will close before submission can complete). Orchestrator decides between rebooking the flight or escalating.",
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
  terminal_tools: ["propose_dates", "submit_packet", "track_endorsement", "escalate_window_missed"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
