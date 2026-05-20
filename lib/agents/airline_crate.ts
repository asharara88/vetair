// Airline & Crate — picks a route + carrier and proposes a CR-82-compliant
// crate spec for the pet. Knows IATA Live Animals Regulations (LAR) at the
// rule-shape level; the country_rules table holds breed/temperature embargo
// facts. Emits a proposed booking for the consensus timeline.

import { type AgentDefinition, validateAgent } from "./types";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "Selects an IATA LAR–compliant route + carrier and sizes the crate (CR-82) for the pet. Proposes a flight slot for the consensus timeline; never books unilaterally.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "read_case",
      description: "Read the case (corridor, target_date, earliest_legal_departure, service_tier).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_pet_facts",
      description: "Read the pet row (species, breed, weight_kg, dimensions if known). Brachycephalic breeds trigger carrier embargoes.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "list_carrier_routes",
      description: "List approved carrier + route combinations between origin and destination. Filter by season for temperature embargoes.",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string" },
          destination: { type: "string" },
          travel_month: { type: "string", description: "YYYY-MM" },
          species: { type: "string" },
          breed: { type: "string" },
        },
        required: ["origin", "destination"],
      },
    },
    {
      name: "size_crate",
      description:
        "Compute the IATA CR-82 crate size band for a pet given weight + standing dimensions. Returns crate L/W/H and the IATA letter code.",
      input_schema: {
        type: "object",
        properties: {
          species: { type: "string" },
          weight_kg: { type: "number" },
          standing_length_cm: { type: "number" },
          standing_height_cm: { type: "number" },
          width_cm: { type: "number" },
        },
        required: ["species", "weight_kg"],
      },
    },
    {
      name: "read_carrier_calendar",
      description: "Read available flights for a carrier + route inside a date window. Returns flight numbers + departure/arrival in UTC.",
      input_schema: {
        type: "object",
        properties: {
          carrier_code: { type: "string", description: "IATA 2-letter (e.g. EK, BA)" },
          route_id: { type: "string" },
          from_date: { type: "string", description: "YYYY-MM-DD" },
          to_date: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["carrier_code", "route_id", "from_date", "to_date"],
      },
    },
    {
      name: "propose_flight",
      description:
        "Terminal: emit a proposed flight slot + crate spec for the consensus timeline. Departure MUST be on or after earliest_legal_departure and inside the owner's target window (±14 days).",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          proposals: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                carrier_code: { type: "string" },
                flight_number: { type: "string" },
                route: { type: "string", description: "e.g. DXB-LHR" },
                departure_utc: { type: "string" },
                arrival_utc: { type: "string" },
                crate_iata_code: { type: "string", description: "e.g. CR-82 size 400" },
                crate_dimensions_cm: {
                  type: "object",
                  properties: {
                    length: { type: "number" },
                    width: { type: "number" },
                    height: { type: "number" },
                  },
                  required: ["length", "width", "height"],
                },
                estimated_cost_usd: { type: "number" },
                rationale: { type: "string" },
              },
              required: [
                "carrier_code",
                "flight_number",
                "route",
                "departure_utc",
                "arrival_utc",
                "crate_iata_code",
                "crate_dimensions_cm",
                "rationale",
              ],
            },
          },
        },
        required: ["case_id", "proposals"],
      },
    },
    {
      name: "block_route",
      description: "Terminal: report that no IATA-compliant route exists for this pet + corridor (e.g. brachycephalic + summer embargo). Used by the orchestrator to escalate.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          embargo_codes: {
            type: "array",
            items: { type: "string" },
            description: "Embargo or rule codes that blocked the route (e.g. 'EK-SNUB-NOSE-SUMMER').",
          },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: ["propose_flight", "block_route"],
  budget: { max_turns: 8, max_input_tokens: 60_000 },
});
