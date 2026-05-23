// Airline & Crate — chooses an IATA-LAR compliant route and crate size for the
// pet. Reads the sim_airline_routes + sim_iata_crate_sizes catalogs in V1; the
// real cargo-booking integration plugs in behind the same tool surface.

import { type AgentDefinition, validateAgent } from "./types";

const CARGO_CLASSES = ["cargo", "checked", "cabin"] as const;

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline Cargo Team",
  description:
    "Selects an IATA-LAR compliant route + crate size for the pet. Honours temperature embargoes, breed-specific carrier rules, and the owner's target window.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "list_routes",
      description:
        "List candidate airline routes for a corridor. Reads sim_airline_routes filtered by origin/destination country.",
      input_schema: {
        type: "object",
        properties: {
          origin_country: { type: "string" },
          destination_country: { type: "string" },
          allow_cargo_only: { type: "boolean" },
        },
        required: ["origin_country", "destination_country"],
      },
    },
    {
      name: "lookup_crate_size",
      description:
        "Look up the IATA CR-82 crate size that matches a pet's weight in kg. Returns size_code + dimensions.",
      input_schema: {
        type: "object",
        properties: { pet_weight_kg: { type: "number" } },
        required: ["pet_weight_kg"],
      },
    },
    {
      name: "read_pet_facts",
      description: "Read the case's pet row (breed, weight, age) to evaluate carrier-specific restrictions.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "propose_routing",
      description:
        "Propose a route + crate combination for the orchestrator's consensus round. Does not book.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          route_id: { type: "string" },
          crate_size_code: { type: "string" },
          travel_class: { type: "string", enum: [...CARGO_CLASSES] },
          proposed_flight_date: { type: "string", description: "ISO date YYYY-MM-DD" },
          rationale: { type: "string" },
        },
        required: ["case_id", "route_id", "crate_size_code", "travel_class", "proposed_flight_date"],
      },
    },
    {
      name: "embargo_blocked",
      description:
        "Terminal: no viable route in the owner's target window because of a temperature embargo or carrier breed ban. Returns the next available date.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_feasible_date: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
    {
      name: "lock_routing",
      description:
        "Terminal: confirm the proposed routing after consensus. Writes the booking intent and hands off to Endorsement for timing.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          route_id: { type: "string" },
          crate_size_code: { type: "string" },
          travel_class: { type: "string", enum: [...CARGO_CLASSES] },
          flight_date: { type: "string" },
        },
        required: ["case_id", "route_id", "crate_size_code", "travel_class", "flight_date"],
      },
    },
  ],
  terminal_tools: ["lock_routing", "embargo_blocked"],
  budget: { max_turns: 6, max_input_tokens: 50_000 },
});
