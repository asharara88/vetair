// Airline & Crate — IATA LAR sizing, route eligibility, temperature embargo.
// Proposes a flight option that consensus will reconcile with the vet and
// endorsement plans.

import { type AgentDefinition, validateAgent } from "./types";
import { ACKNOWLEDGE_AND_WAIT_TOOL, READ_CASE_TOOL } from "./shared-tools";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "Selects IATA LAR-compliant crate + airline + route. Honors temperature embargoes, breed-on-aircraft restrictions, and the earliest legal departure from the assessment.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    READ_CASE_TOOL,
    {
      name: "read_pet_dimensions",
      description:
        "Read the pet row for CR-82 sizing fields (weight_kg, height_cm, length_cm). Returns null fields when unknown — do not guess.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "compute_crate_size",
      description:
        "Run the deterministic CR-82 calculator. Returns {iata_code, length_cm, width_cm, height_cm} or {error} if dimensions are missing.",
      input_schema: {
        type: "object",
        properties: {
          length_cm: { type: "number" },
          width_cm:  { type: "number" },
          height_cm: { type: "number" },
        },
        required: ["length_cm", "width_cm", "height_cm"],
      },
    },
    {
      name: "find_routes",
      description:
        "List candidate cargo routes between origin and destination on or after earliest_legal_departure that accept this species/breed and crate code.",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string" },
          destination: { type: "string" },
          species: { type: "string" },
          breed: { type: "string" },
          crate_iata_code: { type: "string" },
          earliest_departure: { type: "string", description: "ISO date (YYYY-MM-DD)." },
          latest_departure:   { type: "string", description: "ISO date (YYYY-MM-DD)." },
        },
        required: ["origin", "destination", "species", "earliest_departure"],
      },
    },
    {
      name: "check_temperature_embargo",
      description:
        "Check the seasonal temperature embargo for a given carrier + route + month. Authoritative: if it returns embargoed=true, that route is unavailable.",
      input_schema: {
        type: "object",
        properties: {
          carrier: { type: "string" },
          origin: { type: "string" },
          destination: { type: "string" },
          month: { type: "integer", minimum: 1, maximum: 12 },
          species: { type: "string" },
          breed: { type: "string" },
        },
        required: ["carrier", "origin", "destination", "month", "species"],
      },
    },
    {
      name: "propose_flight",
      description:
        "Terminal: emit a candidate flight plan to the consensus round. Use only routes returned by find_routes and a crate_iata_code from compute_crate_size.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier: { type: "string" },
          flight_number: { type: "string" },
          depart_at: { type: "string", description: "ISO timestamp (origin local)." },
          arrive_at: { type: "string", description: "ISO timestamp (destination local)." },
          crate_iata_code: { type: "string" },
          quoted_cargo_usd: { type: "number", minimum: 0 },
          notes: { type: "string" },
        },
        required: ["case_id", "carrier", "flight_number", "depart_at", "crate_iata_code"],
      },
    },
    {
      name: "no_flight_available",
      description:
        "Terminal: no compliant route exists in the requested window. Provide the binding constraint (embargo, breed restriction, no cargo space).",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_alternative: { type: "string", description: "ISO date when the constraint lifts, if known." },
        },
        required: ["case_id", "reason"],
      },
    },
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: ["propose_flight", "no_flight_available", "acknowledge_and_wait"],
  budget: { max_turns: 8, max_input_tokens: 50_000 },
});
