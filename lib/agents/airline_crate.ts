// Airline & Crate — IATA LAR sizing, route selection, temperature embargoes.
// Voice 2 of 3 in the timeline consensus loop. Owns flight feasibility:
// crate dimensions, hold/cabin eligibility, breed-specific carrier policies,
// summer/winter heat embargoes.

import { type AgentDefinition, validateAgent } from "./types";
import { ACKNOWLEDGE_AND_WAIT_TOOL, CASE_ID_INPUT } from "./shared-tools";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "IATA LAR sizing, carrier eligibility, route selection, heat embargo windows. Voice 2 of 3 in the timeline consensus loop.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "read_pet_facts",
      description: "Read the pet row (species, breed, weight) for crate sizing and breed-policy checks.",
      input_schema: CASE_ID_INPUT,
    },
    {
      name: "read_iata_crate_spec",
      description:
        "Look up IATA LAR Container Requirement (CR-82 etc.) sizing for a species + weight. Returns recommended crate dimensions.",
      input_schema: {
        type: "object",
        properties: {
          species: { type: "string" },
          weight_kg: { type: "number", minimum: 0.1 },
          breed: { type: "string" },
        },
        required: ["species", "weight_kg"],
      },
    },
    {
      name: "read_carrier_routes",
      description:
        "Read available carriers + routings for a corridor + species. Returns rows with hold/cabin policy, brachycephalic restrictions, embargo windows.",
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
      name: "read_temperature_embargo",
      description:
        "Check whether a route + date triggers a heat or cold embargo for live animals. Returns blocked windows for the carrier.",
      input_schema: {
        type: "object",
        properties: {
          carrier: { type: "string" },
          origin: { type: "string" },
          destination: { type: "string" },
          target_date: { type: "string", description: "ISO date (YYYY-MM-DD)" },
        },
        required: ["carrier", "origin", "destination", "target_date"],
      },
    },
    {
      name: "propose_booking",
      description:
        "Terminal: propose a flight + crate plan. Orchestrator runs the consensus round before any actual reservation.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier: { type: "string" },
          route: {
            type: "string",
            description: "Origin → connection? → destination as IATA codes (e.g. DXB-LHR or DXB-DOH-LHR).",
          },
          flight_date: { type: "string", description: "ISO date (YYYY-MM-DD)" },
          crate: {
            type: "object",
            properties: {
              iata_size_code: { type: "string" },
              length_cm: { type: "number" },
              width_cm: { type: "number" },
              height_cm: { type: "number" },
            },
            required: ["iata_size_code"],
          },
          hold_or_cabin: { type: "string", enum: ["hold", "cabin"] },
          rationale: { type: "string" },
          cited_rules: { type: "array", items: { type: "string" } },
        },
        required: ["case_id", "carrier", "route", "flight_date", "crate", "hold_or_cabin", "rationale"],
      },
    },
    {
      name: "flag_embargo",
      description:
        "Terminal: no feasible route in the owner's target window because of a heat embargo, breed ban, or capacity cap.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_feasible_date: {
            type: "string",
            description: "ISO date the orchestrator should propose to the owner instead.",
          },
        },
        required: ["case_id", "reason"],
      },
    },
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: ["propose_booking", "flag_embargo", "acknowledge_and_wait"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
