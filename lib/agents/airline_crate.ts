// Airline & Crate — picks an IATA-compliant route + airline and sizes the
// crate per IATA LAR Container Requirement 1 (CR-82) based on the pet's
// measurements. Temperature embargo and breed restrictions enforced.

import { type AgentDefinition, validateAgent } from "./types";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "IATA LAR routing + CR-82 crate sizing. Picks an airline that accepts the species/breed on the corridor and computes crate dimensions from the pet's measurements.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "list_airline_routes",
      description:
        "Read approved airline + route combinations for the corridor. Returns carrier, route legs, accepted species, snub-nose policy, current temperature embargo windows.",
      input_schema: {
        type: "object",
        properties: {
          origin_country: { type: "string" },
          destination_country: { type: "string" },
          species: { type: "string" },
          target_date: { type: "string", description: "ISO date YYYY-MM-DD." },
        },
        required: ["origin_country", "destination_country", "species", "target_date"],
      },
    },
    {
      name: "read_pet_facts",
      description: "Read the pet row for breed, weight, and any stored measurements used for CR-82 sizing.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "compute_crate_size",
      description:
        "Deterministic helper: returns the CR-82 minimum interior dimensions (LxWxH cm) for the pet's measurements. Always call before emitting a plan.",
      input_schema: {
        type: "object",
        properties: {
          length_cm: { type: "number", description: "Nose-to-tail-base length A." },
          height_cm: { type: "number", description: "Floor-to-top-of-shoulder height B." },
          width_cm: { type: "number", description: "Widest body width C." },
          leg_height_cm: { type: "number", description: "Elbow-to-floor leg height D." },
        },
        required: ["length_cm", "height_cm", "width_cm", "leg_height_cm"],
      },
    },
    {
      name: "emit_booking_plan",
      description:
        "Terminal: commit the routing + crate plan. The orchestrator forwards this to consensus and to comms for owner confirmation.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier: { type: "string" },
          route_legs: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                from_iata: { type: "string" },
                to_iata: { type: "string" },
                flight_number: { type: "string" },
                depart_iso: { type: "string" },
              },
              required: ["from_iata", "to_iata", "depart_iso"],
            },
          },
          crate_dimensions_cm: {
            type: "object",
            properties: {
              length: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
            },
            required: ["length", "width", "height"],
          },
          crate_iata_code: {
            type: "string",
            description: "CR-82 IATA series code (e.g. PP20, PP30, PP40, PP50, PP60, PP70).",
          },
          rationale: { type: "string" },
        },
        required: ["case_id", "carrier", "route_legs", "crate_dimensions_cm", "crate_iata_code", "rationale"],
      },
    },
    {
      name: "fail_routing",
      description:
        "Terminal: no compliant route or crate option exists for this corridor + pet. Common reasons: snub-nose breed embargo, temperature embargo across the entire target window, oversized pet exceeds carrier maximums.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          retry_after_date: {
            type: "string",
            description: "Optional ISO date when routing might become feasible (e.g. after a temperature embargo ends).",
          },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: ["emit_booking_plan", "fail_routing"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
