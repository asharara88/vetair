// Endorsement — submits the export endorsement (MOCCAE outbound, APHA inbound,
// USDA-VS for US origins) inside the 7–10 day pre-flight window and tracks
// the courier roundtrip back to the owner before departure.

import { type AgentDefinition, validateAgent } from "./types";

const AUTHORITY = ["moccae_uae", "apha_uk", "usda_vs", "cfia_ca"] as const;

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Submits the official export endorsement (MOCCAE / APHA / USDA-VS / CFIA) inside the 7–10 day pre-flight window and tracks the courier roundtrip.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_booking",
      description:
        "Read the confirmed itinerary (carrier, flight_number, flight_date) and the vet appointment chain.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_endorsement_packet",
      description:
        "Read the assembled endorsement packet — health certificate, microchip + vaccine evidence, import permit. Returns each artifact with verified-status.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "submit_endorsement",
      description:
        "Submit the packet to the destination authority. Records submission_id, submission_at, deadline_at (flight_date - 24h).",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: [...AUTHORITY] },
          submission_method: {
            type: "string",
            enum: ["online_portal", "in_person", "courier"],
          },
          packet_artifact_ids: {
            type: "array",
            items: { type: "string" },
            description: "Document ids assembled into the endorsement packet.",
          },
        },
        required: ["case_id", "authority", "submission_method", "packet_artifact_ids"],
      },
    },
    {
      name: "track_courier",
      description:
        "Look up courier status for a returned endorsement (signed certificate coming back to the owner).",
      input_schema: {
        type: "object",
        properties: {
          courier_tracking_id: { type: "string" },
          carrier: { type: "string", enum: ["aramex", "fedex", "dhl", "ups"] },
        },
        required: ["courier_tracking_id", "carrier"],
      },
    },
    {
      name: "finalize_endorsement",
      description:
        "Terminal: mark endorsement as received and stamp the case ready for transit. Dispatches Comms with the cleared-for-departure message.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          submission_id: { type: "string" },
          received_at: { type: "string", description: "ISO-8601 timestamp" },
        },
        required: ["case_id", "submission_id", "received_at"],
      },
    },
    {
      name: "fail_window_missed",
      description:
        "Terminal: the 7–10 day endorsement window has passed without a returnable signed certificate. Routes to orchestrator — likely requires a flight rebooking.",
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
  terminal_tools: ["finalize_endorsement", "fail_window_missed"],
  budget: { max_turns: 6, max_input_tokens: 30_000 },
});
