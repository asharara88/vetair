// Airline & Crate — IATA LAR / CR-82 sizing + carrier + route selection.
// Respects snub-nosed restrictions and temperature embargoes.

import { type AgentDefinition, validateAgent } from "./types";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "IATA LAR crate sizing and carrier/route selection. Excludes embargoed routes and breed-restricted carriers; proposes >= 2 options when feasible.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "compute_crate_size",
      description:
        "Compute IATA LAR §3.2 internal/external crate dimensions for the pet. Requires length, height, and weight; returns the IATA crate code and ventilation grade.",
      input_schema: {
        type: "object",
        properties: {
          species: { type: "string" },
          breed: { type: "string" },
          weight_kg: { type: "number", minimum: 0 },
          length_cm: { type: "number", minimum: 0 },
          height_cm: { type: "number", minimum: 0 },
        },
        required: ["species", "weight_kg", "length_cm", "height_cm"],
      },
    },
    {
      name: "list_carriers",
      description:
        "List carriers that accept live pet cargo for the corridor on the target date.",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string" },
          destination: { type: "string" },
          species: { type: "string" },
          date: { type: "string" },
        },
        required: ["origin", "destination", "species", "date"],
      },
    },
    {
      name: "read_embargo_calendar",
      description:
        "Read temperature / seasonal embargoes for a carrier + route on a specific date.",
      input_schema: {
        type: "object",
        properties: {
          carrier: { type: "string" },
          route: { type: "string" },
          date: { type: "string" },
        },
        required: ["carrier", "route", "date"],
      },
    },
    {
      name: "read_breed_carrier_restrictions",
      description:
        "Read a carrier's breed-restriction list for snub-nosed and other excluded breeds.",
      input_schema: {
        type: "object",
        properties: {
          carrier: { type: "string" },
          breed: { type: "string" },
        },
        required: ["carrier", "breed"],
      },
    },
    {
      name: "propose_routing",
      description:
        "Persist >= 2 routing options (when feasible) for owner review. Returns proposal_id.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          options: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                carrier: { type: "string" },
                route: { type: "string" },
                depart_date: { type: "string" },
                stops: { type: "integer", minimum: 0 },
                fare_band: {
                  type: "string",
                  enum: ["economy", "premium", "charter"],
                },
              },
              required: ["carrier", "route", "depart_date"],
            },
          },
        },
        required: ["case_id", "options"],
      },
    },
    {
      name: "emit_crate_sizing",
      description:
        "Terminal: record the recommended crate. `justification` must reference the IATA LAR formula used.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          crate_code: { type: "string" },
          internal_dims_cm: {
            type: "object",
            properties: {
              length: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
            },
            required: ["length", "width", "height"],
          },
          justification: { type: "string" },
        },
        required: ["case_id", "crate_code", "internal_dims_cm", "justification"],
      },
    },
    {
      name: "emit_route_recommendation",
      description:
        "Terminal: record the recommended route + carrier + crate pairing. Orchestrator hands off to booking.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier: { type: "string" },
          route: { type: "string" },
          depart_date: { type: "string" },
          crate_code: { type: "string" },
          fare_band: {
            type: "string",
            enum: ["economy", "premium", "charter"],
          },
        },
        required: ["case_id", "carrier", "route", "depart_date", "crate_code"],
      },
    },
    {
      name: "request_dimensions",
      description:
        "Terminal: ask the owner (via Comms) for missing pet dimensions / weight needed for sizing.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          missing_fields: {
            type: "array",
            items: {
              type: "string",
              enum: ["length_cm", "height_cm", "weight_kg"],
            },
            minItems: 1,
          },
        },
        required: ["case_id", "missing_fields"],
      },
    },
  ],
  terminal_tools: [
    "emit_crate_sizing",
    "emit_route_recommendation",
    "request_dimensions",
  ],
  budget: { max_turns: 6, max_input_tokens: 50_000 },
});
