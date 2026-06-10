// Airline & Crate — IATA-LAR carrier rules, CR-82 crate sizing from pet dims,
// embargo-aware itinerary proposal. The prompt enforces brachycephalic /
// in-cabin / temperature embargo branching; this file types the tools.

import { type AgentDefinition, validateAgent } from "./types";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "Designs the route. IATA LAR carrier rules, CR-82 crate sizing from pet dimensions, embargo-aware itinerary that respects the earliest legal departure.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "read_pet_dimensions",
      description: "Read the pet's weight + length / height / width for crate sizing.",
      input_schema: {
        type: "object",
        properties: { pet_id: { type: "string" } },
        required: ["pet_id"],
      },
    },
    {
      name: "read_country_rules",
      description: "Read corridor rules (carrier restrictions, breed bans, embargoes encoded as country_rules rows).",
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
      name: "lookup_routes",
      description: "List candidate routes between origin and destination across a date window. Cargo or in-cabin.",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string" },
          destination: { type: "string" },
          earliest_date: { type: "string" },
          latest_date: { type: "string" },
          cabin_or_cargo: { type: "string", enum: ["cabin", "cargo", "either"] },
        },
        required: ["origin", "destination", "earliest_date", "latest_date"],
      },
    },
    {
      name: "check_embargo",
      description: "Hard-constraint check: does the carrier permit live animals on this route on this date?",
      input_schema: {
        type: "object",
        properties: {
          carrier: { type: "string" },
          route: { type: "string", description: "Origin → destination IATA codes joined by '-' (e.g. DXB-LHR)." },
          date: { type: "string" },
        },
        required: ["carrier", "route", "date"],
      },
    },
    {
      name: "size_crate",
      description: "Compute the IATA size and internal dimensions per CR-82 from the pet's measurements.",
      input_schema: {
        type: "object",
        properties: {
          weight_kg: { type: "number" },
          length_cm: { type: "number" },
          height_cm: { type: "number" },
          width_cm: { type: "number" },
        },
        required: ["weight_kg", "length_cm", "height_cm", "width_cm"],
      },
    },
    {
      name: "propose_itinerary",
      description: "Terminal: emit a concrete itinerary (route + crate spec + departure date). The orchestrator surfaces it to the owner via Comms.",
      input_schema: {
        type: "object",
        properties: {
          route: { type: "string" },
          crate_spec: {
            type: "object",
            properties: {
              iata_size: { type: "string" },
              internal_length_cm: { type: "number" },
              internal_height_cm: { type: "number" },
              internal_width_cm: { type: "number" },
            },
            required: ["iata_size"],
          },
          departure_date: { type: "string" },
        },
        required: ["route", "crate_spec", "departure_date"],
      },
    },
    {
      name: "escalate_no_route",
      description: "Terminal: no feasible itinerary inside the legal window. Routes to the human queue.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: ["propose_itinerary", "escalate_no_route"],
  budget: { max_turns: 6, max_input_tokens: 60_000 },
});
