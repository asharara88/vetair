// Airline & Crate — IATA LAR, CR-82 sizing, route selection, temperature
// embargo. Participates in the consensus timeline loop (AGENT.md §2.2) by
// emitting a flight proposal that the orchestrator reconciles with vet_network
// and endorsement proposals before booking is confirmed.

import { type AgentDefinition, validateAgent, READ_CASE_TOOL, DATE_WINDOW_PROPERTIES } from "./types";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "IATA LAR + CR-82 sizing + route selection. Proposes flights, flags temperature embargo windows, books cargo space.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    READ_CASE_TOOL,
    {
      name: "read_pet_facts",
      description: "Read the case's pet row for weight, breed (brachycephalic check), and species.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "list_carrier_routes",
      description: "Read carrier_routes for a corridor. Returns approved cargo carriers + transit airports + brachycephalic policy.",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string", description: "ISO-3166 alpha-2." },
          destination: { type: "string", description: "ISO-3166 alpha-2." },
          species: { type: "string" },
        },
        required: ["origin", "destination", "species"],
      },
    },
    {
      name: "compute_crate_size",
      description:
        "Deterministic: compute the IATA CR-82 required interior dimensions for the pet's weight and species. Authoritative — do not infer crate sizes yourself.",
      input_schema: {
        type: "object",
        properties: {
          species: { type: "string" },
          weight_kg: { type: "number" },
          length_cm: { type: "number", description: "Pet length nose-to-tail-base." },
          height_cm: { type: "number", description: "Pet height floor-to-shoulder." },
        },
        required: ["species", "weight_kg"],
      },
    },
    {
      name: "check_temperature_embargo",
      description:
        "Read transit-airport embargo windows for the species + breed group over a date range. Returns embargo blocks and their cause.",
      input_schema: {
        type: "object",
        properties: {
          carrier: { type: "string" },
          route: { type: "string", description: "Origin-via-transit-to-destination IATA codes joined by `-`." },
          species: { type: "string" },
          breed_group: { type: "string", description: "e.g. `brachycephalic`, `working`, `none`." },
          from_date: { type: "string" },
          to_date: { type: "string" },
        },
        required: ["carrier", "route", "species", "from_date", "to_date"],
      },
    },
    {
      name: "propose_flight",
      description:
        "Terminal: propose a flight for the consensus timeline round. Does NOT book. Must include the crate size from compute_crate_size and pass check_temperature_embargo for the window.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier: { type: "string" },
          route: { type: "string" },
          crate_class: { type: "string", description: "IATA CR-82 class code, e.g. PR-1 through PR-7." },
          ...DATE_WINDOW_PROPERTIES,
          rationale: { type: "string", description: "Why this carrier + route + window. Cite embargo checks and crate fit." },
        },
        required: ["case_id", "carrier", "route", "crate_class", "earliest_date", "latest_date", "preferred_date", "rationale"],
      },
    },
    {
      name: "book_flight",
      description:
        "Terminal: confirm cargo booking. Use ONLY after the orchestrator returns a consensus-approved date matching a proposal.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier: { type: "string" },
          route: { type: "string" },
          flight_date: { type: "string" },
          crate_class: { type: "string" },
        },
        required: ["case_id", "carrier", "route", "flight_date", "crate_class"],
      },
    },
    {
      name: "escalate_route_blocker",
      description:
        "Terminal: no viable route exists for the corridor + species + window (embargo wall, no cargo capacity, brachycephalic ban). Hand to a human.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          blocker: { type: "string", enum: ["embargo", "no_capacity", "brachycephalic_ban", "permit_mismatch", "other"] },
          detail: { type: "string" },
        },
        required: ["case_id", "blocker", "detail"],
      },
    },
  ],
  terminal_tools: ["propose_flight", "book_flight", "escalate_route_blocker"],
  budget: { max_turns: 8, max_input_tokens: 50_000 },
});
