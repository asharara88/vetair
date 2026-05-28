// Airline & Crate — selects an IATA-compliant route, sizes the crate per the
// IATA LAR / CR-82 container requirement, and proposes flight dates into the
// consensus timeline loop. Flags temperature/breed embargoes that close the
// travel window.

import { type AgentDefinition, validateAgent } from "./types";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "logistics",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate Team",
  description:
    "Selects an IATA-compliant route, sizes the travel crate (IATA LAR / CR-82), and proposes flight dates into the consensus timeline loop. Flags temperature and breed embargoes.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "read_case_plan",
      description: "Read the case corridor, target_date, and earliest_legal_departure.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_pet_facts",
      description: "Read the pet row (species, breed, weight_kg) so the crate can be sized correctly.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "size_crate",
      description:
        "Compute the IATA LAR / CR-82 crate dimensions and container code from the pet's measurements. Deterministic — never estimate sizing by hand.",
      input_schema: {
        type: "object",
        properties: {
          species: { type: "string" },
          weight_kg: { type: "number" },
          length_cm: { type: "number" },
          height_cm: { type: "number" },
        },
        required: ["species", "weight_kg"],
      },
    },
    {
      name: "find_routes",
      description: "List candidate routes for the corridor near the target date, with carrier, layover, and live temperature-embargo status.",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string" },
          destination: { type: "string" },
          target_date: { type: "string", description: "YYYY-MM-DD" },
          species: { type: "string" },
        },
        required: ["origin", "destination", "species"],
      },
    },
    {
      name: "propose_flights",
      description:
        "Terminal: submit candidate flight dates into the timeline consensus round. Each proposal must clear the temperature embargo and fall on or after earliest_legal_departure.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          proposals: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                route_id: { type: "string" },
                flight_date: { type: "string", description: "YYYY-MM-DD" },
                crate_size: { type: "string", description: "IATA container code, e.g. CR-82 size 300" },
              },
              required: ["route_id", "flight_date", "crate_size"],
            },
          },
        },
        required: ["case_id", "proposals"],
      },
    },
    {
      name: "book_flight",
      description: "Terminal: lock the route and crate once the orchestrator has confirmed a feasible plan.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          route_id: { type: "string" },
          flight_date: { type: "string", description: "YYYY-MM-DD" },
          crate_size: { type: "string" },
        },
        required: ["case_id", "route_id", "flight_date", "crate_size"],
      },
    },
    {
      name: "flag_embargo",
      description:
        "Terminal: no compliant route exists in the window. Use for a live temperature embargo or a snub-nosed/breed carrier restriction.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_clear_date: { type: "string", description: "YYYY-MM-DD, if the embargo is seasonal" },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: ["propose_flights", "book_flight", "flag_embargo"],
  budget: { max_turns: 8, max_input_tokens: 60_000 },
});
