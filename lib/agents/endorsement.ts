// Endorsement — packages and submits the OV-signed health certificate to the
// origin country's veterinary authority within the corridor's pre-flight window.

import { type AgentDefinition, validateAgent } from "./types";

const ENDORSEMENT_AUTHORITIES = ["MOCCAE", "USDA-APHIS", "APHA", "EU-NCA"] as const;

const ENDORSEMENT_STATUSES = [
  "submitted",
  "in_review",
  "approved",
  "rejected",
  "delivered",
] as const;

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement Desk",
  description:
    "Compiles the health-certificate packet and submits it to the origin country's veterinary authority (MOCCAE, USDA-APHIS, APHA, EU NCA). Tracks to courier delivery.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_endorsement_window",
      description:
        "Return the corridor's endorsement window: authority + open/close timestamps.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "compile_packet",
      description:
        "Assemble the endorsement packet from the case's documents. Returns the included_docs[] and any missing_docs[] still needed.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "submit_endorsement",
      description:
        "Submit a compiled packet to the destination authority. Requires the packet_id from compile_packet.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: [...ENDORSEMENT_AUTHORITIES] },
          packet_id: { type: "string" },
        },
        required: ["case_id", "authority", "packet_id"],
      },
    },
    {
      name: "read_submission_status",
      description:
        "Read the current status of an existing submission, including courier tracking when available.",
      input_schema: {
        type: "object",
        properties: { submission_id: { type: "string" } },
        required: ["submission_id"],
      },
    },
    {
      name: "emit_endorsement_status",
      description:
        "Terminal: record the latest endorsement status for the case. Pass `courier_tracking: null` when the authority has not assigned one.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          status: { type: "string", enum: [...ENDORSEMENT_STATUSES] },
          courier_tracking: { type: ["string", "null"] },
        },
        required: ["case_id", "status"],
      },
    },
    {
      name: "request_endorsement_packet",
      description:
        "Terminal: the packet is incomplete or the submission window is closed. Lists missing_docs[] for the orchestrator to source.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          missing_docs: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
          },
        },
        required: ["case_id", "missing_docs"],
      },
    },
  ],
  terminal_tools: ["emit_endorsement_status", "request_endorsement_packet"],
  budget: { max_turns: 5, max_input_tokens: 40_000 },
});
