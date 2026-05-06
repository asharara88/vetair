// Airline & Crate — IATA LAR + CR-82 sizing + route + temperature embargo.
// Deterministic crate math is in lib/compliance/evaluators.ts later; this
// agent reasons about route choice, layovers, and embargo windows that
// require Sonnet's judgment, not a closed-form rule.

import { type AgentDefinition, validateAgent } from "./types";

const CABIN_CLASSIFICATION = ["cabin", "checked", "manifest_cargo"] as const;

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "Routes the pet on an IATA-LAR-compliant airline with a CR-82-sized crate, avoiding seasonal temperature embargoes and brachycephalic restrictions.",
  prompt_path: "lib/prompts/airline-crate.md",
  tools: [
    {
      name: "list_approved_carriers",
      description:
        "Read the approved_carriers table for routes serving this corridor. Filtered to airlines that accept the pet's species + size class.",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string", description: "IATA airport code" },
          destination: { type: "string", description: "IATA airport code" },
          species: { type: "string" },
        },
        required: ["origin", "destination", "species"],
      },
    },
    {
      name: "compute_crate_spec",
      description:
        "Compute the IATA CR-82 crate spec from pet dimensions. Returns interior L×W×H + ventilation requirement.",
      input_schema: {
        type: "object",
        properties: {
          length_cm: { type: "number", minimum: 1 },
          height_cm: { type: "number", minimum: 1 },
          width_cm: { type: "number", minimum: 1 },
          weight_kg: { type: "number", minimum: 0.1 },
        },
        required: ["length_cm", "height_cm", "width_cm", "weight_kg"],
      },
    },
    {
      name: "check_embargo",
      description:
        "Check seasonal temperature embargoes for a flight date + route + species. Returns blocked/allowed with rationale.",
      input_schema: {
        type: "object",
        properties: {
          carrier: { type: "string" },
          origin: { type: "string" },
          destination: { type: "string" },
          flight_date: { type: "string", description: "YYYY-MM-DD" },
          species: { type: "string" },
          breed: { type: "string" },
        },
        required: ["carrier", "origin", "destination", "flight_date", "species"],
      },
    },
    {
      name: "propose_itinerary",
      description:
        "Stage a candidate itinerary for the orchestrator's consensus round. Non-terminal.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier: { type: "string" },
          flight_number: { type: "string" },
          origin: { type: "string" },
          destination: { type: "string" },
          flight_date: { type: "string", description: "YYYY-MM-DD" },
          classification: { type: "string", enum: [...CABIN_CLASSIFICATION] },
          crate_spec: {
            type: "object",
            description: "Output of compute_crate_spec.",
          },
          rationale: { type: "string" },
        },
        required: [
          "case_id",
          "carrier",
          "flight_number",
          "origin",
          "destination",
          "flight_date",
          "classification",
          "crate_spec",
          "rationale",
        ],
      },
    },
    {
      name: "book_itinerary",
      description:
        "Terminal: confirm the proposed itinerary. Writes the booking row and dispatches Comms + Endorsement.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier: { type: "string" },
          flight_number: { type: "string" },
          flight_date: { type: "string" },
          classification: { type: "string", enum: [...CABIN_CLASSIFICATION] },
          crate_spec: { type: "object" },
        },
        required: [
          "case_id",
          "carrier",
          "flight_number",
          "flight_date",
          "classification",
          "crate_spec",
        ],
      },
    },
    {
      name: "fail_no_route",
      description:
        "Terminal: no compliant carrier+date combination exists. Routes back to orchestrator for replan.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_clear_date: {
            type: "string",
            description: "YYYY-MM-DD — soonest date the embargo / restriction lifts, if known.",
          },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: ["book_itinerary", "fail_no_route"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
