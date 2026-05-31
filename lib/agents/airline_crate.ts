// Airline & Crate — proposes a feasible flight route + crate. Second of the
// three "proposers" in the consensus timeline loop (§2.2). Cites IATA LAR + the
// destination's carrier rules; does not actually book — booking is a forward
// procedure once consensus locks the plan.

import { type AgentDefinition, validateAgent } from "./types";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "Proposes a feasible route: IATA LAR-compliant carrier, CR-82 crate sizing, temperature-embargo aware.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "read_pet_dimensions",
      description:
        "Read the pet row fields needed for crate sizing (weight_kg, height_cm, length_cm, breed). Returns the IATA CR-82 measurement set the airline expects.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "list_routes",
      description:
        "List candidate IATA LAR-compliant routes for a corridor + species, including direct + one-stop options.",
      input_schema: {
        type: "object",
        properties: {
          origin_country: { type: "string" },
          destination_country: { type: "string" },
          species: { type: "string" },
        },
        required: ["origin_country", "destination_country", "species"],
      },
    },
    {
      name: "size_crate",
      description:
        "Compute the smallest IATA CR-82-compliant crate size for a pet's dimensions. Returns the size code (XS..XXL) and required internal cm.",
      input_schema: {
        type: "object",
        properties: {
          weight_kg: { type: "number", minimum: 0 },
          length_cm: { type: "number", minimum: 0 },
          height_cm: { type: "number", minimum: 0 },
          width_cm: { type: "number", minimum: 0 },
        },
        required: ["weight_kg", "length_cm", "height_cm"],
      },
    },
    {
      name: "check_temperature_embargo",
      description:
        "Check whether a route+date is inside a carrier's heat/cold embargo. Returns the embargo window if applicable.",
      input_schema: {
        type: "object",
        properties: {
          route_id: { type: "string" },
          travel_date: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["route_id", "travel_date"],
      },
    },
    {
      name: "emit_route_proposal",
      description:
        "Terminal: emit the proposed route + crate spec + viable date window for the consensus round.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          route_id: { type: "string" },
          crate_size_code: { type: "string" },
          earliest_date: { type: "string", description: "YYYY-MM-DD" },
          latest_date: { type: "string", description: "YYYY-MM-DD" },
          cited_rules: {
            type: "array",
            items: { type: "string" },
            description: "IATA / carrier rule codes that justify the proposal.",
          },
        },
        required: ["case_id", "route_id", "crate_size_code", "earliest_date", "latest_date", "cited_rules"],
      },
    },
    {
      name: "request_dimensions",
      description: "Terminal: dimensions are missing; ask the owner via Comms for length/height/weight.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "fail_no_route",
      description:
        "Terminal: no carrier in the corridor will fly this pet within the target window (embargo, breed ban, weight cutoff).",
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
  terminal_tools: ["emit_route_proposal", "request_dimensions", "fail_no_route"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
