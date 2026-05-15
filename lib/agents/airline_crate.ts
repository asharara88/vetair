// Airline & Crate — selects route + carrier under IATA LAR, sizes the
// CR-82 crate, and flags temperature embargo windows. Proposes a flight
// slate that the consensus timeline round will reconcile with the vet
// network and endorsement proposals.

import { type AgentDefinition, validateAgent } from "./types";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "Selects route + carrier under IATA LAR, sizes the CR-82 crate, and flags temperature embargo windows.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "read_pet_facts",
      description:
        "Read the pet row (species, breed, weight_kg, dimensions if recorded) so you can size the crate.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "list_carriers",
      description:
        "List carriers serving the corridor with live-animal cargo capability. Returns iata_code, hub, species_accepted, breed_restrictions, temperature_embargo (months), notes.",
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
      name: "size_crate",
      description:
        "Compute the IATA CR-82 crate size for the pet. Returns recommended internal dimensions (cm), CR-code, and weight headroom.",
      input_schema: {
        type: "object",
        properties: {
          length_cm: { type: "number" },
          height_cm: { type: "number" },
          width_cm: { type: "number" },
          weight_kg: { type: "number" },
        },
        required: ["length_cm", "height_cm", "width_cm", "weight_kg"],
      },
    },
    {
      name: "propose_flight",
      description:
        "Terminal: emit the proposed flight slate. Orchestrator runs the consensus timeline round against vet + endorsement proposals.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier_iata: { type: "string" },
          flight_number: { type: "string" },
          depart_at: { type: "string", description: "ISO 8601 UTC departure timestamp." },
          arrive_at: { type: "string", description: "ISO 8601 UTC arrival timestamp." },
          crate_code: { type: "string", description: "IATA crate code (e.g. CR-82-100)." },
          temperature_safe: { type: "boolean" },
          rationale: { type: "string" },
        },
        required: [
          "case_id",
          "carrier_iata",
          "flight_number",
          "depart_at",
          "arrive_at",
          "crate_code",
          "temperature_safe",
          "rationale",
        ],
      },
    },
    {
      name: "flag_embargo",
      description:
        "Terminal: no compliant flight exists in the target window because of a temperature or breed embargo. Includes the earliest legal departure on the other side of the embargo.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_legal_departure: {
            type: "string",
            description: "ISO date of the next viable departure window.",
          },
        },
        required: ["case_id", "reason", "earliest_legal_departure"],
      },
    },
  ],
  terminal_tools: ["propose_flight", "flag_embargo"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
