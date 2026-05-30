// Airline & Crate — picks an IATA-compliant route and a CR-82-sized crate.
// Hard constraints (temperature embargo, breed bans on the carrier, crate
// dimensions) are deterministic; the agent's job is to apply judgment about
// trade-offs (one-stop vs direct, AVI vs cargo class, season-of-year risk).

import { type AgentDefinition, validateAgent } from "./types";
import { ACKNOWLEDGE_AND_WAIT_TOOL } from "./shared-tools";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate Team",
  description:
    "Selects an IATA-LAR-compliant route + CR-82 crate for the pet, respecting temperature embargoes and carrier breed restrictions.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "read_case_facts",
      description: "Read case + pet (species, breed, weight, height_at_shoulder) and corridor.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "compute_crate_size",
      description:
        "Deterministic: returns the IATA CR-82 minimum internal dimensions for the pet (length / width / height in cm) and the canonical crate model name (Sky Kennel / Vari-Kennel / Petmate).",
      input_schema: {
        type: "object",
        properties: {
          species: { type: "string", enum: ["dog", "cat", "ferret"] },
          weight_kg: { type: "number", minimum: 0.1, maximum: 90 },
          shoulder_cm: { type: "number", minimum: 5, maximum: 120 },
          nose_to_tail_base_cm: { type: "number", minimum: 10, maximum: 200 },
        },
        required: ["species", "weight_kg"],
      },
    },
    {
      name: "search_routes",
      description:
        "Search candidate routes for the corridor + target_date window. Returns at most 8 routes with carrier, flight numbers, stops, transit-hub IATA codes, AVI vs manifest cargo, and a temperature_risk score (0-1) derived from forecast highs at each ground point.",
      input_schema: {
        type: "object",
        properties: {
          origin_iata: { type: "string" },
          destination_iata: { type: "string" },
          target_date: { type: "string", description: "ISO date." },
          flex_days: { type: "integer", minimum: 0, maximum: 14 },
        },
        required: ["origin_iata", "destination_iata", "target_date"],
      },
    },
    {
      name: "check_carrier_breed_policy",
      description:
        "Returns the named carrier's policy on this breed (allowed / brachycephalic_restricted / banned) and any seasonal embargo windows.",
      input_schema: {
        type: "object",
        properties: {
          carrier_iata: { type: "string", description: "2-letter IATA airline code." },
          species: { type: "string" },
          breed: { type: "string" },
        },
        required: ["carrier_iata", "species", "breed"],
      },
    },
    {
      name: "propose_routing",
      description:
        "Terminal: write a routing proposal (route + crate spec + quote breakdown). Status='proposed'; the orchestrator decides whether to surface it to the owner or hold for human review.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier_iata: { type: "string" },
          flight_segments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                flight_number: { type: "string" },
                from_iata: { type: "string" },
                to_iata: { type: "string" },
                depart_local: { type: "string" },
                arrive_local: { type: "string" },
              },
              required: ["flight_number", "from_iata", "to_iata", "depart_local", "arrive_local"],
            },
            minItems: 1,
          },
          crate_model: { type: "string" },
          crate_internal_cm: {
            type: "object",
            properties: {
              length: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
            },
            required: ["length", "width", "height"],
          },
          rationale: { type: "string" },
          quote_amount_usd: { type: "number", minimum: 0 },
        },
        required: ["case_id", "carrier_iata", "flight_segments", "crate_model", "rationale"],
      },
    },
    {
      name: "no_route_available",
      description:
        "Terminal: no compliant route exists in the current window (e.g. embargo + carrier ban combination). Hand back so the owner can be asked to flex the date.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_feasible_date: { type: "string", description: "ISO date, if known." },
        },
        required: ["case_id", "reason"],
      },
    },
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: ["propose_routing", "no_route_available", "acknowledge_and_wait"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
