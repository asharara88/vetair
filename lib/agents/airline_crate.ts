// Airline & Crate — IATA Live Animal Regulations (LAR), CR-82 crate sizing,
// route selection, and temperature embargo evaluation. Proposes a flight +
// crate spec into the consensus timeline loop alongside vet_network and
// endorsement.

import { type AgentDefinition, validateAgent } from "./types";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "Selects an IATA-compliant carrier + route, sizes a CR-82 crate, and screens for temperature embargoes. Proposes a flight into the consensus timeline loop.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "read_pet_dimensions",
      description:
        "Read the pet's species, breed, and measured dimensions for crate sizing. Returns weight_kg + L/W/H if measured, else nulls.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "lookup_iata_carriers",
      description:
        "List IATA-LAR-compliant carriers serving the route + species. Returns carrier code, animal handling rating, and pet-program SKU.",
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
      name: "check_temperature_embargo",
      description:
        "Check the carrier's temperature embargo for the route + travel date. Returns `clear`, `warn` (within 5°C of limit), or `block`.",
      input_schema: {
        type: "object",
        properties: {
          carrier: { type: "string" },
          origin: { type: "string" },
          destination: { type: "string" },
          travel_date: { type: "string", description: "ISO date" },
          species: { type: "string" },
        },
        required: ["carrier", "origin", "destination", "travel_date", "species"],
      },
    },
    {
      name: "compute_crate_spec",
      description:
        "Compute the CR-82 minimum interior dimensions and recommended SKU for a pet. Inputs use centimetres; outputs are { interior_length_cm, interior_width_cm, interior_height_cm, sku_recommendation }.",
      input_schema: {
        type: "object",
        properties: {
          species: { type: "string" },
          a_cm: { type: "number", description: "Nose to base of tail (A)" },
          b_cm: { type: "number", description: "Height at elbow (B)" },
          c_cm: { type: "number", description: "Width at shoulders (C)" },
          d_cm: { type: "number", description: "Top of head/ear to ground standing (D)" },
        },
        required: ["species", "a_cm", "b_cm", "c_cm", "d_cm"],
      },
    },
    {
      name: "propose_routing",
      description:
        "Terminal: propose a carrier + flight + crate spec into the consensus round. Orchestrator reconciles against vet_network + endorsement before booking.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier: { type: "string" },
          flight_no: { type: "string" },
          travel_date: { type: "string", description: "ISO date" },
          crate_sku: { type: "string" },
          cited_rules: {
            type: "array",
            items: { type: "string" },
            description: "requirement_codes this routing satisfies (e.g. crate_size, carrier_approved).",
          },
        },
        required: ["case_id", "carrier", "flight_no", "travel_date", "crate_sku", "cited_rules"],
      },
    },
    {
      name: "fail_no_route",
      description:
        "Terminal: abort. Use when no IATA-compliant carrier serves the route in the legal window or every option is embargoed.",
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
  terminal_tools: ["propose_routing", "fail_no_route"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
