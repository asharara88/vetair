// Airline & Crate — picks an IATA-LAR compliant route, sizes the CR-82
// crate from pet weight + breed, and checks live temperature embargoes.
// Books are proposed, not committed — Orchestrator + Comms confirm with owner.

import { type AgentDefinition, validateAgent } from "./types";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "Selects an IATA-LAR-compliant route, sizes the CR-82 crate from pet weight + breed, and checks live temperature embargoes per leg.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "read_pet_dimensions",
      description:
        "Read pet weight_kg, breed, and (if measured) shoulder height + body length. Required for CR-82 sizing.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "size_crate",
      description:
        "Compute the CR-82 crate inner dimensions (L × W × H cm) given height, length, and species. Output the next standard IATA crate size code (e.g. PP30, VariKennel 500).",
      input_schema: {
        type: "object",
        properties: {
          species: { type: "string" },
          shoulder_height_cm: { type: "number" },
          body_length_cm: { type: "number" },
          weight_kg: { type: "number" },
        },
        required: ["species", "weight_kg"],
      },
    },
    {
      name: "list_routes",
      description:
        "List candidate routes (origin → destination) for the case's species + crate size + target window. Returns airline, flight numbers, layovers, and live embargo status.",
      input_schema: {
        type: "object",
        properties: {
          origin_iata: { type: "string" },
          destination_iata: { type: "string" },
          target_date: { type: "string", description: "ISO YYYY-MM-DD" },
          species: { type: "string" },
          crate_size_code: { type: "string" },
        },
        required: ["origin_iata", "destination_iata", "target_date", "species"],
      },
    },
    {
      name: "check_temperature_embargo",
      description:
        "Check the temperature embargo on each leg of a route for the proposed date. Many carriers refuse snub-nosed breeds when ground temp is above 27°C or below 0°C.",
      input_schema: {
        type: "object",
        properties: {
          route_id: { type: "string" },
          date: { type: "string" },
          species: { type: "string" },
          breed: { type: "string" },
        },
        required: ["route_id", "date", "species"],
      },
    },
    {
      name: "emit_routing",
      description:
        "Terminal: propose a route + crate spec. The owner can still veto via Comms; this is not a booking.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          route_id: { type: "string" },
          crate_size_code: { type: "string" },
          crate_dimensions_cm: {
            type: "object",
            properties: {
              length: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
            },
            required: ["length", "width", "height"],
          },
          estimated_cost_usd: { type: "number" },
          cited_rules: {
            type: "array",
            items: { type: "string" },
            description: "requirement_codes the routing satisfies (carrier, crate, temperature).",
          },
        },
        required: ["case_id", "route_id", "crate_size_code", "crate_dimensions_cm", "cited_rules"],
      },
    },
    {
      name: "fail_routing",
      description:
        "Terminal: abort. Use when no candidate route survives embargo + crate constraints in the owner's target window.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_feasible_date: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: ["emit_routing", "fail_routing"],
  budget: { max_turns: 6, max_input_tokens: 60_000 },
});
