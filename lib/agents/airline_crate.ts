// Airline & Crate — selects the route and locks the cargo / cabin booking.
// Reasons over IATA LAR carriage rules, CR-82 crate sizing, breed snub-nose
// restrictions, temperature embargoes, and the case's target window.

import { type AgentDefinition, validateAgent } from "./types";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "Selects the route and locks the cargo / cabin booking. Applies IATA LAR, CR-82 sizing, breed snub-nose restrictions, and temperature embargoes.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "read_pet_facts",
      description: "Read pet species, breed, weight, dimensions, snub-nose status.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_case_window",
      description: "Read the case target_date, earliest_legal_departure, and corridor.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_carrier_rules",
      description:
        "Read carrier_rules + temperature embargoes for the corridor (origin → destination, species, weight class).",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string" },
          destination: { type: "string" },
          species: { type: "string" },
        },
        required: ["origin", "destination", "species"],
      },
    },
    {
      name: "search_routes",
      description:
        "Search candidate cargo / cabin routes within the case's target window, filtered by carrier_rules.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          earliest_iso: { type: "string" },
          latest_iso: { type: "string" },
          mode: { type: "string", enum: ["cargo", "cabin", "either"] },
        },
        required: ["case_id", "earliest_iso", "latest_iso"],
      },
    },
    {
      name: "recommend_crate",
      description:
        "Recommend the CR-82-compliant crate size given pet dimensions. Non-terminal — feeds into the booking proposal.",
      input_schema: {
        type: "object",
        properties: {
          length_cm: { type: "number" },
          width_cm: { type: "number" },
          height_cm: { type: "number" },
          weight_kg: { type: "number" },
        },
        required: ["length_cm", "width_cm", "height_cm", "weight_kg"],
      },
    },
    {
      name: "lock_booking",
      description:
        "Terminal: lock the selected route + crate. Writes to bookings, sets case.state to `booking_locked`.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier: { type: "string" },
          flight_number: { type: "string" },
          depart_iso: { type: "string" },
          arrive_iso: { type: "string" },
          mode: { type: "string", enum: ["cargo", "cabin"] },
          crate_size_code: { type: "string", description: "e.g. CR-82-300, CR-82-400." },
          quote_amount_usd: { type: "number" },
        },
        required: [
          "case_id",
          "carrier",
          "flight_number",
          "depart_iso",
          "arrive_iso",
          "mode",
          "crate_size_code",
        ],
      },
    },
    {
      name: "block_booking",
      description:
        "Terminal: no feasible booking exists in the case window (embargo, no cargo space, breed banned). Hand back to orchestrator with reason.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_feasible_iso: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
    {
      name: "ask_user_for_input",
      description: "Terminal: ask the owner via Comms for a missing fact (e.g. flexible on cabin vs cargo).",
      input_schema: {
        type: "object",
        properties: {
          field: { type: "string" },
          question: { type: "string" },
        },
        required: ["field", "question"],
      },
    },
  ],
  terminal_tools: ["lock_booking", "block_booking", "ask_user_for_input"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
