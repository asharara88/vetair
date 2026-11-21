// Airline & Crate — picks a routing + carrier + IATA LAR-compliant crate size.
// Enforces temperature embargo windows and CR-82 breed/size restrictions.
// Emits a booking proposal for the timeline consensus round.

import { type AgentDefinition, validateAgent } from "./types";
import { ACKNOWLEDGE_AND_WAIT_TOOL } from "./shared-tools";

const CARRIER_SERVICES = ["manifest_cargo", "excess_baggage", "in_cabin"] as const;

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "Selects routing and IATA LAR-compliant crate size. Enforces CR-82 breed restrictions and temperature embargo windows. Emits a booking proposal.",
  prompt_path: "lib/prompts/airline-crate.md",
  tools: [
    {
      name: "read_case_facts",
      description: "Read case + pet facts needed to size a crate (weight, breed, dimensions) and pick a route.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "list_routes",
      description: "List candidate routes between origin and destination airports for the target date window.",
      input_schema: {
        type: "object",
        properties: {
          origin_country: { type: "string" },
          destination_country: { type: "string" },
          target_date: { type: "string", description: "YYYY-MM-DD; may be shifted by embargo" },
          service: { type: "string", enum: [...CARRIER_SERVICES] },
        },
        required: ["origin_country", "destination_country", "target_date"],
      },
    },
    {
      name: "check_embargo",
      description:
        "Check whether a route has an active temperature/breed/species embargo for the target date. Deterministic, authoritative.",
      input_schema: {
        type: "object",
        properties: {
          carrier: { type: "string" },
          route: { type: "string", description: "e.g. DXB-LHR" },
          species: { type: "string" },
          breed: { type: "string" },
          target_date: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["carrier", "route", "species", "target_date"],
      },
    },
    {
      name: "size_crate",
      description:
        "Compute the required IATA CR-82 crate size from pet dimensions. Returns the recommended container variant and interior dims in cm.",
      input_schema: {
        type: "object",
        properties: {
          length_cm: { type: "number" },
          height_cm: { type: "number" },
          width_cm: { type: "number" },
          weight_kg: { type: "number" },
          species: { type: "string" },
        },
        required: ["length_cm", "height_cm", "width_cm", "weight_kg", "species"],
      },
    },
    {
      name: "propose_booking",
      description:
        "Terminal: emit the proposed routing + crate + service for the timeline consensus. Must cite the embargo check and crate sizing in rationale.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier: { type: "string" },
          route: { type: "string" },
          service: { type: "string", enum: [...CARRIER_SERVICES] },
          flight_date: { type: "string", description: "YYYY-MM-DD" },
          crate_spec: {
            type: "object",
            properties: {
              iata_variant: { type: "string", description: "e.g. CR-82 500 / 700" },
              interior_l_cm: { type: "number" },
              interior_h_cm: { type: "number" },
              interior_w_cm: { type: "number" },
            },
            required: ["iata_variant", "interior_l_cm", "interior_h_cm", "interior_w_cm"],
          },
          rationale: { type: "string" },
        },
        required: ["case_id", "carrier", "route", "service", "flight_date", "crate_spec", "rationale"],
      },
    },
    {
      name: "block_booking",
      description:
        "Terminal: no feasible route exists in the target window (embargo, CR-82 ban, no cargo space). Escalate to Comms for date renegotiation.",
      input_schema: {
        type: "object",
        properties: {
          reason: { type: "string" },
          earliest_feasible_date: { type: "string", description: "YYYY-MM-DD; null if indefinite" },
        },
        required: ["reason"],
      },
    },
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: ["propose_booking", "block_booking", "acknowledge_and_wait"],
  budget: { max_turns: 6, max_input_tokens: 50_000 },
});

export const AIRLINE_CARRIER_SERVICES = CARRIER_SERVICES;
