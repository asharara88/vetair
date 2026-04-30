// Airline & Crate — IATA LAR sizing, route selection, temperature embargo.
// Proposes a flight + crate spec; the consensus loop accepts or rejects.

import { type AgentDefinition, validateAgent } from "./types";
import { READ_CASE_TOOL, READ_PET_FACTS_TOOL } from "./tools";

const TRANSPORT_MODES = ["cargo", "manifest_cargo", "in_cabin", "checked"] as const;

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "logistics",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "Selects IATA LAR-compliant routes and computes crate sizing (CR-82). Honours species + breed embargoes and seasonal heat restrictions.",
  prompt_path: "lib/prompts/airline-crate.md",
  tools: [
    READ_CASE_TOOL,
    READ_PET_FACTS_TOOL,
    {
      name: "list_routes",
      description:
        "Read routes filtered by corridor + species + weight class. Returns carrier, transport_mode, embargo_windows, base_price_usd.",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string" },
          destination: { type: "string" },
          species: { type: "string" },
          weight_kg: { type: "number", minimum: 0 },
        },
        required: ["origin", "destination", "species"],
      },
    },
    {
      name: "check_embargo",
      description:
        "Check whether a given route + flight_date collides with a temperature, breed, or carrier embargo.",
      input_schema: {
        type: "object",
        properties: {
          route_id: { type: "string" },
          flight_date: { type: "string", description: "ISO date YYYY-MM-DD." },
        },
        required: ["route_id", "flight_date"],
      },
    },
    {
      name: "compute_crate",
      description:
        "Deterministic helper: compute IATA CR-82 crate dimensions from species, weight, and length. Returns recommended crate code (e.g. 200, 300, 400).",
      input_schema: {
        type: "object",
        properties: {
          species: { type: "string" },
          weight_kg: { type: "number", minimum: 0 },
          length_cm: { type: "number", minimum: 0, description: "Nose-to-base-of-tail." },
          height_cm: { type: "number", minimum: 0, description: "Floor to top of head, standing." },
        },
        required: ["species", "weight_kg", "length_cm", "height_cm"],
      },
    },
    {
      name: "propose_booking",
      description:
        "Terminal: propose a flight + crate for the consensus timeline. Orchestrator votes; do not assume acceptance.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          route_id: { type: "string" },
          flight_date: { type: "string", description: "ISO date YYYY-MM-DD." },
          transport_mode: { type: "string", enum: [...TRANSPORT_MODES] },
          crate_code: {
            type: "string",
            description: "IATA CR-82 crate size code, e.g. 100, 200, 300, 400, 500, 700.",
          },
          estimated_cost_usd: { type: "number", minimum: 0 },
          rationale: { type: "string" },
        },
        required: [
          "case_id",
          "route_id",
          "flight_date",
          "transport_mode",
          "crate_code",
          "rationale",
        ],
      },
    },
    {
      name: "fail_no_route",
      description:
        "Terminal: abort. Use when no IATA-compliant route can carry the pet inside the legal window (embargo, weight, or breed restriction).",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: ["propose_booking", "fail_no_route"],
  budget: { max_turns: 5, max_input_tokens: 40_000 },
});
