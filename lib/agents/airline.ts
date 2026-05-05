// Airline & Crate — picks the IATA-compliant crate, selects an airline whose
// breed-restriction policy permits the pet, and books the cargo slot.
// Reads breed_restrictions and country_rules; never invents airline rules.

import { type AgentDefinition, validateAgent } from "./types";
import { ACKNOWLEDGE_AND_WAIT_TOOL, READ_CASE_TOOL } from "./shared";

const IATA_CRATE_CODES = [
  "PP10", "PP20", "PP30", "PP40", "PP50",
  "PP60", "PP70", "PP80", "PP90", "PP100",
] as const;

export const AIRLINE: AgentDefinition = validateAgent({
  name: "airline",
  type: "airline",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "Picks an IATA-compliant crate size from the pet's measurements and books a cargo slot on an airline whose breed policy permits the pet.",
  prompt_path: "lib/prompts/airline.md",
  tools: [
    READ_CASE_TOOL,
    {
      name: "read_pet_facts",
      description:
        "Read pet facts including weight_kg, height_cm, length_cm, breed. Required for crate sizing and breed-restriction lookup.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_breed_restrictions",
      description:
        "Look up breed_restrictions for the destination corridor. Returns hard bans and conditional rules per airline.",
      input_schema: {
        type: "object",
        properties: {
          species: { type: "string" },
          breed: { type: "string" },
          destination: { type: "string", description: "ISO-3166 alpha-2 of the destination country." },
        },
        required: ["species", "breed", "destination"],
      },
    },
    {
      name: "list_airlines",
      description:
        "List airlines with available cargo capacity on the requested corridor + date window. Returns airline_iata, route, departure, price_band.",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string", description: "Origin IATA airport code." },
          destination: { type: "string", description: "Destination IATA airport code." },
          earliest_departure: { type: "string", description: "ISO-8601 date." },
          latest_departure: { type: "string", description: "ISO-8601 date." },
          species: { type: "string" },
        },
        required: ["origin", "destination", "earliest_departure", "latest_departure", "species"],
      },
    },
    {
      name: "recommend_crate",
      description:
        "Terminal: emit the IATA crate recommendation. The PP code MUST come from the IATA table — never invent a code. Dimensions in cm; tolerance is ±2cm per IATA Live Animals Regulations.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          iata_code: { type: "string", enum: [...IATA_CRATE_CODES] },
          internal_dimensions_cm: {
            type: "object",
            properties: {
              length: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
            },
            required: ["length", "width", "height"],
          },
          rationale: {
            type: "string",
            description: "How the size was derived from pet measurements (length + leg-tip, height-at-shoulder + ear).",
          },
        },
        required: ["case_id", "iata_code", "internal_dimensions_cm", "rationale"],
      },
    },
    {
      name: "book_cargo_slot",
      description:
        "Terminal: book an airline cargo slot. Must reference an airline returned by list_airlines and a crate from recommend_crate.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          airline_iata: { type: "string", description: "Two-letter IATA airline code." },
          flight_number: { type: "string" },
          departure_at: { type: "string", description: "ISO-8601 datetime." },
          crate_iata_code: { type: "string", enum: [...IATA_CRATE_CODES] },
        },
        required: ["case_id", "airline_iata", "flight_number", "departure_at", "crate_iata_code"],
      },
    },
    {
      name: "blocked_by_breed",
      description:
        "Terminal: every candidate airline rejects the breed for this corridor. Comms must explain to the owner; no further dispatch.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          breed: { type: "string" },
          destination: { type: "string" },
          rejecting_airlines: {
            type: "array",
            items: { type: "string" },
            description: "IATA codes of airlines that explicitly bar the breed.",
          },
        },
        required: ["case_id", "breed", "destination", "rejecting_airlines"],
      },
    },
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: ["recommend_crate", "book_cargo_slot", "blocked_by_breed", "acknowledge_and_wait"],
  budget: { max_turns: 5, max_input_tokens: 40_000 },
});

export const AIRLINE_IATA_CRATE_CODES = IATA_CRATE_CODES;
