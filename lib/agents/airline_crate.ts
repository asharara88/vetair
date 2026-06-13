// Airline & Crate — picks a route + crate sizing for the booked travel window.
// Inputs: pet weight + breed (for snub-nose carriage bans), corridor, target
// date. Output: a quote the Comms agent can show the owner.

import { type AgentDefinition, validateAgent } from "./types";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "Selects an IATA-LAR-compliant route and a CR-82 crate size for the pet. Enforces temperature embargoes and snub-nose carriage bans.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "read_pet_dimensions",
      description: "Read species, breed, weight_kg, and standing height of the pet — drives crate sizing.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_corridor",
      description: "Read the case's origin, destination, target_date and earliest_legal_departure.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "find_routes",
      description: "Query airline routes for a corridor and date window. Returns carrier + cabin + transit airports.",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string" },
          destination: { type: "string" },
          earliest_date: { type: "string", description: "ISO date" },
          latest_date: { type: "string", description: "ISO date" },
          species: { type: "string" },
        },
        required: ["origin", "destination", "earliest_date", "latest_date", "species"],
      },
    },
    {
      name: "size_crate",
      description: "Compute the CR-82 crate size (A–L) and external dimensions from pet measurements.",
      input_schema: {
        type: "object",
        properties: {
          length_cm: { type: "number" },
          width_cm: { type: "number" },
          standing_height_cm: { type: "number" },
        },
        required: ["length_cm", "width_cm", "standing_height_cm"],
      },
    },
    {
      name: "propose_booking",
      description:
        "Terminal: hand the owner a concrete carrier + crate spec + price quote. Must include the route id, total cost USD, and the crate code.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          route_id: { type: "string" },
          crate_code: { type: "string", description: "IATA CR-82 size code (A-L)" },
          total_cost_usd: { type: "number" },
          embargo_notes: { type: "string", description: "Any seasonal embargo the owner must know about." },
        },
        required: ["case_id", "route_id", "crate_code", "total_cost_usd"],
      },
    },
    {
      name: "block_booking",
      description:
        "Terminal: no compliant route exists in the window. Examples: snub-nose carriage ban, temperature embargo, no cargo space.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_unblocked_date: { type: "string", description: "ISO date or null" },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: ["propose_booking", "block_booking"],
  budget: { max_turns: 5, max_input_tokens: 40_000 },
});
