// Airline & Crate — IATA LAR rules, CR-82 sizing, route selection,
// temperature embargo. Proposes a route + crate spec; flags embargoed
// corridors so Orchestrator can re-plan.

import { type AgentDefinition, validateAgent } from "./types";
import { readCaseTool, readPetFactsTool } from "./tools";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "IATA LAR + CR-82 reasoning. Selects approved airline + flight, sizes the crate to the pet, and flags temperature embargoes that block the corridor.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    readCaseTool(),
    readPetFactsTool(),
    {
      name: "list_carrier_options",
      description:
        "List airlines whose live-animal program serves the corridor on or around the target date. Returns each option's pet acceptance class (manifest cargo / accompanied baggage), aircraft type, and known restrictions.",
      input_schema: {
        type: "object",
        properties: {
          origin_country: { type: "string" },
          destination_country: { type: "string" },
          target_date: { type: "string", description: "ISO YYYY-MM-DD" },
          species: { type: "string" },
        },
        required: ["origin_country", "destination_country", "target_date", "species"],
      },
    },
    {
      name: "compute_crate_spec",
      description:
        "Compute the IATA CR-82 crate size from the pet's standing height (A), shoulder width (B), and length (C). Returns recommended crate dimensions + ventilation class.",
      input_schema: {
        type: "object",
        properties: {
          species: { type: "string" },
          weight_kg: { type: "number" },
          measurements: {
            type: "object",
            description: "Pet measurements in cm (A=height, B=width, C=length).",
            properties: {
              standing_height_cm: { type: "number" },
              shoulder_width_cm: { type: "number" },
              length_cm: { type: "number" },
            },
          },
        },
        required: ["species", "weight_kg"],
      },
    },
    {
      name: "check_temperature_embargo",
      description:
        "Check the live-animal embargo on the target route for the target date. Returns a verdict (`clear` | `embargoed`) plus the next clear date if blocked.",
      input_schema: {
        type: "object",
        properties: {
          carrier: { type: "string" },
          origin_iata: { type: "string" },
          destination_iata: { type: "string" },
          target_date: { type: "string" },
          species: { type: "string" },
        },
        required: ["carrier", "origin_iata", "destination_iata", "target_date"],
      },
    },
    {
      name: "propose_route",
      description:
        "Propose a flight + crate spec to the consensus timeline. Caller does not book — Orchestrator confirms after Vet + Endorsement proposals align.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier: { type: "string" },
          flight_number: { type: "string" },
          origin_iata: { type: "string" },
          destination_iata: { type: "string" },
          departure_date: { type: "string" },
          crate_class: { type: "string" },
          crate_dimensions_cm: {
            type: "object",
            properties: {
              length: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
            },
          },
          rationale: { type: "string" },
        },
        required: ["case_id", "carrier", "flight_number", "departure_date", "crate_class"],
      },
    },
    {
      name: "select_route",
      description: "Terminal: lock in the route after Orchestrator approval. Books the cargo slot.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier: { type: "string" },
          flight_number: { type: "string" },
          departure_date: { type: "string" },
          booking_reference: { type: "string" },
        },
        required: ["case_id", "carrier", "flight_number", "departure_date"],
      },
    },
    {
      name: "flag_embargo",
      description:
        "Terminal: target date is inside a temperature embargo for every viable carrier. Returns the next clear window so Orchestrator can re-plan.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          earliest_clear_date: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "earliest_clear_date", "reason"],
      },
    },
    {
      name: "flag_breed_carrier_restriction",
      description:
        "Terminal: every carrier on the corridor refuses the breed (e.g. brachycephalic ban). No re-planning will resolve.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          breed: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "breed", "reason"],
      },
    },
  ],
  terminal_tools: ["select_route", "flag_embargo", "flag_breed_carrier_restriction"],
  budget: { max_turns: 8, max_input_tokens: 50_000 },
});
