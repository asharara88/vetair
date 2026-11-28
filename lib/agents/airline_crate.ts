// Airline & Crate — selects a route and a CR-82 (IATA LAR) compliant crate.
// Reasons over IATA Live Animal Regulations, breed-specific carrier bans
// (e.g. snub-nosed embargoes), temperature embargoes, and cargo availability.
// Produces a flight+crate proposal with citations back to carrier policy and
// corridor rules. Does NOT book — proposal only; booking confirmation is a
// forward procedure gated on owner acceptance.

import { type AgentDefinition, validateAgent } from "./types";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "Selects a route and CR-82 compliant crate. Applies IATA LAR, breed carrier bans, and temperature embargoes; proposes a flight + crate pairing with citations.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "read_pet_dimensions",
      description: "Read pet weight, breed, and recorded shoulder/length measurements (if present) from the pet row.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "list_carrier_policies",
      description: "List carrier policies for a corridor. Returns breed restrictions, temperature embargoes, cargo cutoffs, booking windows.",
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
      name: "compute_crate_size",
      description: "Deterministic helper. Given shoulder height, length, and weight, returns the IATA CR-82 size code (100, 200, 300, 400, 500) and internal dimensions.",
      input_schema: {
        type: "object",
        properties: {
          shoulder_cm: { type: "number" },
          length_cm: { type: "number" },
          weight_kg: { type: "number" },
        },
        required: ["shoulder_cm", "length_cm", "weight_kg"],
      },
    },
    {
      name: "propose_flight",
      description: "Terminal: propose a concrete flight + crate pairing. `cited_policies` must reference the carrier policy ids returned from list_carrier_policies.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier: { type: "string" },
          flight_number: { type: "string" },
          departure_date: { type: "string", description: "ISO YYYY-MM-DD" },
          origin_airport: { type: "string", description: "IATA 3-letter code" },
          destination_airport: { type: "string", description: "IATA 3-letter code" },
          crate_size_code: {
            type: "string",
            enum: ["100", "200", "300", "400", "500", "custom"],
          },
          cited_policies: {
            type: "array",
            items: { type: "string" },
            description: "Carrier policy ids and corridor requirement_codes justifying this choice.",
          },
        },
        required: [
          "case_id",
          "carrier",
          "departure_date",
          "origin_airport",
          "destination_airport",
          "crate_size_code",
          "cited_policies",
        ],
      },
    },
    {
      name: "request_pet_measurement",
      description: "Terminal: ask the owner via Comms for a missing shoulder height or length measurement — CR-82 sizing needs it.",
      input_schema: {
        type: "object",
        properties: {
          missing: {
            type: "array",
            items: { type: "string", enum: ["shoulder_cm", "length_cm", "weight_kg"] },
            minItems: 1,
          },
        },
        required: ["missing"],
      },
    },
    {
      name: "no_feasible_route",
      description: "Terminal: no carrier serves this corridor+species within the compliance window. Escalates to human.",
      input_schema: {
        type: "object",
        properties: {
          reason: { type: "string" },
          blocking_policy: { type: "string" },
        },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: ["propose_flight", "request_pet_measurement", "no_feasible_route"],
  budget: { max_turns: 8, max_input_tokens: 60_000 },
});
