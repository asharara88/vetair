// Airline & Crate — IATA LAR crate sizing, carrier/route selection,
// temperature-embargo arithmetic. Proposes a feasible cargo booking.

import { type AgentDefinition, validateAgent } from "./types";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "IATA LAR + CR-82 sizing, carrier-route selection, temperature-embargo arithmetic. Proposes a feasible cargo booking window.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "read_pet_dimensions",
      description:
        "Read pet weight, standing height, length (nose→tail base), and width. Returns null fields when not yet measured.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "compute_crate_size",
      description:
        "Deterministic: run the IATA LAR CR-82 formula on the given dimensions and return the smallest compliant crate SKU in the crate_inventory table. Authoritative — the LLM must not do the arithmetic itself.",
      input_schema: {
        type: "object",
        properties: {
          weight_kg: { type: "number", minimum: 0 },
          standing_height_cm: { type: "number", minimum: 0 },
          length_cm: { type: "number", minimum: 0 },
          width_cm: { type: "number", minimum: 0 },
        },
        required: ["weight_kg", "standing_height_cm", "length_cm", "width_cm"],
      },
    },
    {
      name: "read_routes",
      description:
        "Read the carrier_routes table for the corridor. Each row includes carrier, flight_no, cargo_category (manifest/excess_baggage/in_cabin), aircraft_type, live_animal_approved, temperature_embargo_months[], max_crate_dimension_cm, next_available_departures[].",
      input_schema: {
        type: "object",
        properties: {
          origin_country: { type: "string" },
          destination_country: { type: "string" },
          species: { type: "string", enum: ["dog", "cat", "ferret"] },
        },
        required: ["origin_country", "destination_country", "species"],
      },
    },
    {
      name: "check_temperature_embargo",
      description:
        "Deterministic: given a candidate departure date and the route's embargo window, return true if the flight is bookable for live animals on that date.",
      input_schema: {
        type: "object",
        properties: {
          route_id: { type: "string" },
          departure_date: { type: "string", description: "ISO-8601 date." },
        },
        required: ["route_id", "departure_date"],
      },
    },
    {
      name: "propose_booking",
      description:
        "Terminal: emit a concrete booking proposal. The route_id and crate_sku must come from the read tools; departure_date must satisfy the embargo check and the case's earliest_legal_departure.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          route_id: { type: "string" },
          departure_date: { type: "string" },
          crate_sku: { type: "string" },
          cargo_category: {
            type: "string",
            enum: ["manifest_cargo", "excess_baggage", "in_cabin"],
          },
          rationale: { type: "string" },
        },
        required: ["case_id", "route_id", "departure_date", "crate_sku", "cargo_category", "rationale"],
      },
    },
    {
      name: "request_remeasure",
      description:
        "Terminal: pet dimensions are missing or stale. Escalates to the vet_network agent for a re-measure on the next appointment.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          missing_fields: { type: "array", items: { type: "string" } },
        },
        required: ["case_id", "missing_fields"],
      },
    },
    {
      name: "no_feasible_route",
      description:
        "Terminal: no live-animal route in the carrier_routes table can seat this crate on an embargo-clear day inside the owner's window.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_alternate: {
            type: "string",
            description: "ISO date of the earliest feasible departure if the owner's window is widened.",
          },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: ["propose_booking", "request_remeasure", "no_feasible_route"],
  budget: { max_turns: 6, max_input_tokens: 50_000 },
});
