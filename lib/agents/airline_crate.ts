// Airline & Crate — selects route + carrier and sizes a CR-82 IATA-LAR
// compliant crate. Reasons over breed, weight, age, route, temperature embargoes.

import { type AgentDefinition, validateAgent } from "./types";
import { ACKNOWLEDGE_AND_WAIT } from "./shared-tools";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "Picks a carrier + route and sizes the IATA LAR / CR-82 compliant crate. Honors temperature embargoes, snub-nose breed restrictions, and the carrier's pet-cargo policy.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "read_pet_dimensions",
      description:
        "Read pet measurements (weight_kg, height_cm, length_cm) for crate sizing. Returns null fields if the owner has not supplied them yet.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "list_carriers",
      description:
        "Read approved carriers for a corridor. Returns pet-cargo policy, snub-nose embargo list, and seasonal heat/cold embargo windows.",
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
      name: "read_assessment",
      description:
        "Read the latest compliance assessment so you know which carrier_rule citations apply.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "compute_crate_size",
      description:
        "Compute the CR-82 IATA-LAR crate size band (A–N) from height_cm + length_cm. Pure deterministic math; never hallucinate dimensions.",
      input_schema: {
        type: "object",
        properties: {
          height_cm: { type: "number" },
          length_cm: { type: "number" },
          width_cm: { type: "number" },
        },
        required: ["height_cm", "length_cm", "width_cm"],
      },
    },
    {
      name: "propose_route",
      description:
        "Terminal: write a proposed carrier + flight + crate band to flight_proposals. Owner confirms via Comms before booking.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier_code: { type: "string", description: "IATA airline code (e.g. EK, BA)." },
          origin_airport: { type: "string", description: "IATA 3-letter (e.g. DXB)." },
          destination_airport: { type: "string", description: "IATA 3-letter (e.g. LHR)." },
          earliest_date: { type: "string", description: "ISO YYYY-MM-DD" },
          latest_date: { type: "string", description: "ISO YYYY-MM-DD" },
          crate_band: {
            type: "string",
            enum: ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N"],
          },
          cited_rules: {
            type: "array",
            items: { type: "string" },
            description: "Requirement codes covering carrier_rule, breed_restriction, age_restriction.",
          },
        },
        required: [
          "case_id",
          "carrier_code",
          "origin_airport",
          "destination_airport",
          "earliest_date",
          "latest_date",
          "crate_band",
          "cited_rules",
        ],
      },
    },
    {
      name: "no_route_available",
      description:
        "Terminal: no carrier on this corridor accepts this pet under current rules (snub-nose + summer embargo, breed ban, etc.). Escalates to Orchestrator.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          cited_rules: { type: "array", items: { type: "string" } },
        },
        required: ["case_id", "reason", "cited_rules"],
      },
    },
    ACKNOWLEDGE_AND_WAIT,
  ],
  terminal_tools: ["propose_route", "no_route_available", "acknowledge_and_wait"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
