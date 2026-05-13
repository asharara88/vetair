// Airline & Crate — applies IATA Live Animals Regulations + CR-82 crate sizing,
// selects a route, checks seasonal temperature embargoes, and proposes a flight.
// Reads (not writes) the country rule set; bookings are confirmed only after
// the consensus round locks a date.

import { type AgentDefinition, validateAgent } from "./types";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "Applies IATA LAR + CR-82 crate sizing, picks a route around temperature embargoes, and proposes a feasible flight for the consensus round.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "list_routes",
      description: "Read candidate routes between origin and destination airports for a given species.",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string", description: "IATA airport code or ISO country" },
          destination: { type: "string", description: "IATA airport code or ISO country" },
          species: { type: "string" },
        },
        required: ["origin", "destination", "species"],
      },
    },
    {
      name: "size_crate",
      description:
        "Compute the IATA CR-82 minimum container dimensions from pet measurements. Returns {length_cm, width_cm, height_cm, container_size}.",
      input_schema: {
        type: "object",
        properties: {
          length_a_cm: { type: "number", description: "Nose to root of tail." },
          height_b_cm: { type: "number", description: "Floor to elbow joint." },
          width_c_cm: { type: "number", description: "Widest point across the shoulders." },
          height_d_cm: { type: "number", description: "Floor to top of head or ears (whichever is taller)." },
        },
        required: ["length_a_cm", "height_b_cm", "width_c_cm", "height_d_cm"],
      },
    },
    {
      name: "check_temperature_embargo",
      description:
        "Check carrier + airport temperature embargoes for a target date. Returns {embargoed: boolean, reason?: string, alternatives?: string[]}.",
      input_schema: {
        type: "object",
        properties: {
          carrier: { type: "string", description: "IATA airline code" },
          airport: { type: "string", description: "IATA airport code" },
          date: { type: "string", description: "YYYY-MM-DD" },
          species: { type: "string" },
          breed: { type: "string" },
        },
        required: ["carrier", "airport", "date", "species"],
      },
    },
    {
      name: "check_breed_carrier_rule",
      description: "Verify the breed is not snub-nosed/brachycephalic on the carrier's no-fly list.",
      input_schema: {
        type: "object",
        properties: {
          carrier: { type: "string" },
          species: { type: "string" },
          breed: { type: "string" },
        },
        required: ["carrier", "species", "breed"],
      },
    },
    {
      name: "propose_route",
      description:
        "Terminal: emit a candidate route + flight into the consensus round. Must include cited carrier rules (CR-82, embargoes, breed restrictions).",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier: { type: "string" },
          flight_number: { type: "string" },
          origin_airport: { type: "string" },
          destination_airport: { type: "string" },
          candidate_dates: {
            type: "array",
            items: { type: "string", description: "YYYY-MM-DD" },
            minItems: 1,
            maxItems: 5,
          },
          container_size: { type: "string", description: "e.g. IATA-300, IATA-400, …" },
          cited_rules: { type: "array", items: { type: "string" } },
        },
        required: [
          "case_id",
          "carrier",
          "origin_airport",
          "destination_airport",
          "candidate_dates",
          "container_size",
          "cited_rules",
        ],
      },
    },
    {
      name: "book_flight",
      description: "Terminal: confirm the flight reservation once the consensus round has locked a date.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier: { type: "string" },
          flight_number: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD" },
          container_size: { type: "string" },
        },
        required: ["case_id", "carrier", "flight_number", "date", "container_size"],
      },
    },
    {
      name: "no_feasible_route",
      description:
        "Terminal: signal that no carrier/route satisfies the corridor + species + breed constraints within the owner's window. Escalates.",
      input_schema: {
        type: "object",
        properties: {
          reason: { type: "string" },
          earliest_legal_date: { type: "string", description: "YYYY-MM-DD if known" },
        },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: ["propose_route", "book_flight", "no_feasible_route"],
  budget: { max_turns: 6, max_input_tokens: 50_000 },
});
