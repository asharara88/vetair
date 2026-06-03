// Airline & Crate — picks a feasible carrier + route + IATA-compliant crate.
// Reasons over IATA Live Animals Regulations, CR-82 sizing, and seasonal
// temperature embargoes. Output is a route proposal with cited carrier rules.

import { type AgentDefinition, validateAgent } from "./types";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "Selects carrier, route, and IATA CR-82 crate. Honors per-airline breed embargoes and seasonal temperature holds.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "read_pet_facts",
      description: "Read the pet row — weight, breed, dimensions if measured.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_carrier_rules",
      description: "Read carrier_rules for a corridor: per-airline embargoes, breed bans, hold/cabin policy.",
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
      name: "size_crate",
      description:
        "Compute the IATA CR-82 crate size (A×B×C×D in cm) from pet shoulder, body, and tail measurements. Returns the smallest legal size.",
      input_schema: {
        type: "object",
        properties: {
          length_cm: { type: "number" },
          height_cm: { type: "number" },
          width_cm: { type: "number" },
        },
        required: ["length_cm", "height_cm", "width_cm"],
      },
    },
    {
      name: "check_temperature_embargo",
      description:
        "Check whether any segment of a candidate route triggers a heat or cold embargo for the species on the proposed travel date.",
      input_schema: {
        type: "object",
        properties: {
          route: { type: "array", items: { type: "string" } },
          travel_date: { type: "string" },
          species: { type: "string" },
        },
        required: ["route", "travel_date", "species"],
      },
    },
    {
      name: "propose_route",
      description:
        "Terminal: emit a route proposal. `carrier_rules_cited` must reference rule codes from `read_carrier_rules`. `crate_size` is one of CR-82 standard sizes (XS/S/M/L/XL/XXL/giant).",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier: { type: "string" },
          route: { type: "array", items: { type: "string" } },
          travel_date: { type: "string" },
          crate_size: { type: "string", enum: ["XS", "S", "M", "L", "XL", "XXL", "giant"] },
          hold_or_cabin: { type: "string", enum: ["hold", "cabin"] },
          carrier_rules_cited: { type: "array", items: { type: "string" } },
        },
        required: [
          "case_id",
          "carrier",
          "route",
          "travel_date",
          "crate_size",
          "hold_or_cabin",
          "carrier_rules_cited",
        ],
      },
    },
    {
      name: "block_route",
      description:
        "Terminal: no feasible route. Use when every candidate carrier hits an embargo, breed ban, or unmeetable crate constraint.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          blocking_rules: { type: "array", items: { type: "string" } },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: ["propose_route", "block_route"],
  budget: { max_turns: 6, max_input_tokens: 50_000 },
});
