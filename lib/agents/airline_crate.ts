// Airline & Crate — picks an IATA-LAR-compliant carrier + route for the
// corridor, sizes the CR-82 crate from the pet's measurements, and clears
// breed / temperature embargoes. Outputs a routing proposal that the
// consensus timeline loop weighs against vet + endorsement schedules.

import { type AgentDefinition, validateAgent } from "./types";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "IATA LAR + CR-82 sizing + route selection. Clears breed and temperature embargoes for the corridor and proposes a routing for the consensus timeline.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "read_pet_facts",
      description: "Read the pet row (species, breed, weight, length/height/width if measured).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "size_crate",
      description:
        "Compute the IATA CR-82 minimum crate dimensions from the pet's body measurements. Returns recommended internal dimensions and a CR-82 standard size code.",
      input_schema: {
        type: "object",
        properties: {
          length_cm: { type: "number", minimum: 1 },
          height_cm: { type: "number", minimum: 1 },
          width_cm: { type: "number", minimum: 1 },
          weight_kg: { type: "number", minimum: 0.1 },
        },
        required: ["length_cm", "height_cm", "width_cm", "weight_kg"],
      },
    },
    {
      name: "search_routes",
      description:
        "Search live carrier inventory for routes between origin and destination on or after a target date. Filtered by pet acceptance + crate size code.",
      input_schema: {
        type: "object",
        properties: {
          origin_iata: { type: "string", minLength: 3, maxLength: 3 },
          destination_iata: { type: "string", minLength: 3, maxLength: 3 },
          earliest_date: { type: "string", description: "ISO-8601 date." },
          latest_date: { type: "string", description: "ISO-8601 date." },
          species: { type: "string" },
          crate_size_code: { type: "string", description: "e.g. PP-50, PP-70, CR-82-L." },
        },
        required: ["origin_iata", "destination_iata", "earliest_date", "species", "crate_size_code"],
      },
    },
    {
      name: "check_breed_embargo",
      description:
        "Check carrier and destination embargoes for snub-nosed breeds, banned breeds, and seasonal heat embargoes.",
      input_schema: {
        type: "object",
        properties: {
          carrier_code: { type: "string", description: "2-letter IATA airline code." },
          species: { type: "string" },
          breed: { type: "string" },
          travel_date: { type: "string", description: "ISO-8601 date." },
        },
        required: ["carrier_code", "species", "travel_date"],
      },
    },
    {
      name: "propose_routing",
      description:
        "Terminal: emit a routing proposal — chosen carrier, flight numbers, crate size, total transit hours. Cite the rule codes that drive carrier and embargo choices.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier_code: { type: "string" },
          flights: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                flight_number: { type: "string" },
                origin_iata: { type: "string" },
                destination_iata: { type: "string" },
                depart_at: { type: "string", description: "ISO-8601." },
                arrive_at: { type: "string", description: "ISO-8601." },
              },
              required: ["flight_number", "origin_iata", "destination_iata", "depart_at", "arrive_at"],
            },
          },
          crate: {
            type: "object",
            properties: {
              size_code: { type: "string" },
              internal_length_cm: { type: "number" },
              internal_height_cm: { type: "number" },
              internal_width_cm: { type: "number" },
            },
            required: ["size_code", "internal_length_cm", "internal_height_cm", "internal_width_cm"],
          },
          total_transit_hours: { type: "number", minimum: 0 },
          quote_amount_usd: { type: "number", minimum: 0 },
          cited_rules: {
            type: "array",
            items: { type: "string" },
            description: "Requirement codes covering carrier acceptance + embargo clearance.",
          },
        },
        required: ["case_id", "carrier_code", "flights", "crate", "total_transit_hours", "cited_rules"],
      },
    },
    {
      name: "embargo_blocked",
      description:
        "Terminal: no compliant routing exists in the requested window (e.g. summer heat embargo on a snub-nosed breed). Returns the next legal travel date for the orchestrator to renegotiate with the owner.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_legal_date: { type: "string", description: "ISO-8601 date." },
          cited_rules: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
          },
        },
        required: ["case_id", "reason", "earliest_legal_date", "cited_rules"],
      },
    },
  ],
  terminal_tools: ["propose_routing", "embargo_blocked"],
  budget: { max_turns: 6, max_input_tokens: 50_000 },
});
