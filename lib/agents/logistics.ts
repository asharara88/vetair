// Logistics — books the airline + crate once Compliance has approved a case.
// Picks up where the deterministic engine's `evalApprovedCarrier` hands off:
// pre-approval the choice is just "pending — forward procedure"; post-approval
// the Orchestrator dispatches Logistics to pick a carrier/route/crate that
// satisfies the corridor's restrictions and the pet's species + weight.

import { type AgentDefinition, validateAgent } from "./types";
import {
  acknowledgeAndWaitTool,
  readAssessmentTool,
  readCaseTool,
} from "./shared-tools";

export const LOGISTICS: AgentDefinition = validateAgent({
  name: "logistics",
  type: "logistics",
  model: "claude-sonnet-4-6",
  user_facing_label: "Logistics Team",
  description:
    "Books flights + crate once Compliance has approved a case. Honours per-corridor airline approvals, IATA crate sizing, and the owner's target travel window.",
  prompt_path: "lib/prompts/logistics.md",
  tools: [
    readCaseTool("Read corridor, target travel window, and pet/owner context for the booking."),
    readAssessmentTool(
      "Read the latest assessment. Logistics is a no-op unless the verdict is `approved` or `conditionally_approved`.",
    ),
    {
      name: "read_pet_facts",
      description: "Read species, breed, weight, and microchip — required for IATA crate sizing.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "list_airline_options",
      description:
        "List airlines approved on the corridor for the pet's species + weight class. Each option includes routing, transit constraints, and live cabin/hold availability.",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string" },
          destination: { type: "string" },
          travel_window_start: { type: "string", description: "ISO date" },
          travel_window_end: { type: "string", description: "ISO date" },
          species: { type: "string" },
          weight_kg: { type: "number", minimum: 0 },
        },
        required: ["origin", "destination", "travel_window_start", "species"],
      },
    },
    {
      name: "hold_booking",
      description:
        "Place a tentative hold on a specific option. Holds expire automatically; this is reversible and NOT terminal.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          option_ref: { type: "string", description: "ID from list_airline_options." },
          crate_size: {
            type: "string",
            enum: ["IATA_100", "IATA_200", "IATA_300", "IATA_400", "IATA_500", "IATA_700"],
          },
          hold_expires_iso: { type: "string", description: "When the hold lapses." },
        },
        required: ["case_id", "option_ref", "crate_size"],
      },
    },
    {
      name: "confirm_booking",
      description:
        "Terminal: convert a held option into a confirmed booking. Writes to bookings and emits a booking confirmation row.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          hold_ref: { type: "string" },
          confirmation_code: { type: "string" },
          depart_iso: { type: "string" },
          arrive_iso: { type: "string" },
          total_cost_usd: { type: "number", minimum: 0 },
        },
        required: ["case_id", "hold_ref", "confirmation_code", "depart_iso", "arrive_iso"],
      },
    },
    {
      name: "request_crate_specs",
      description:
        "Terminal: ask Comms to request crate dimensions/photos from the owner when the pet's weight straddles a size tier and IATA sizing is ambiguous.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "abort_booking",
      description:
        "Terminal: abort. Use when no approved carrier serves the corridor in the target window, or when the assessment verdict is not yet `approved`.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_retry_iso: {
            type: "string",
            description: "ISO date — when it's worth re-running logistics. Null if unknown.",
          },
        },
        required: ["case_id", "reason"],
      },
    },
    acknowledgeAndWaitTool(
      "Terminal: yield without booking. Use when a hold is in place and we are waiting on owner sign-off.",
    ),
  ],
  terminal_tools: [
    "confirm_booking",
    "request_crate_specs",
    "abort_booking",
    "acknowledge_and_wait",
  ],
  budget: { max_turns: 6, max_input_tokens: 50_000 },
});
