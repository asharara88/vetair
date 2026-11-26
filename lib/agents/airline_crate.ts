// Airline & Crate — IATA LAR compliance, CR-82 sizing, route selection,
// temperature embargo awareness. Participates in the consensus-timeline
// loop (AGENT.md §2.2) by proposing one or more feasible flight dates.

import { type AgentDefinition, validateAgent } from "./types";

const CRATE_CODES = ["CR-82"] as const;
const CABIN_CLASSES = ["cargo", "manifest_cargo", "excess_baggage", "in_cabin"] as const;

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "IATA LAR + CR-82 sizing, pet-friendly carrier selection, temperature embargo + layover rules. Proposes flight dates for the consensus timeline.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "read_case_facts",
      description:
        "Read the pet row (species, breed, weight_kg), the corridor, and the target_date / earliest_legal_departure window.",
      input_schema: {
        type: "object" as const,
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "list_pet_friendly_carriers",
      description:
        "List carriers that accept live animals on the requested corridor. Returns embargo windows + cabin policy per carrier.",
      input_schema: {
        type: "object" as const,
        properties: {
          origin_country: { type: "string" },
          destination_country: { type: "string" },
          species: { type: "string" },
        },
        required: ["origin_country", "destination_country", "species"],
      },
    },
    {
      name: "size_crate",
      description:
        "Deterministic: compute IATA CR-82 interior dimensions + carrier-accepted crate codes for a pet's measurements. Authoritative on sizing.",
      input_schema: {
        type: "object" as const,
        properties: {
          species: { type: "string" },
          weight_kg: { type: "number", minimum: 0 },
          height_cm: { type: "number", minimum: 0 },
          length_cm: { type: "number", minimum: 0 },
          width_cm: { type: "number", minimum: 0 },
        },
        required: ["species", "weight_kg"],
      },
    },
    {
      name: "read_temperature_embargo",
      description:
        "Deterministic: read the temperature-embargo calendar for a carrier + route + species. Returns blackout date ranges.",
      input_schema: {
        type: "object" as const,
        properties: {
          carrier_code: { type: "string" },
          origin_country: { type: "string" },
          destination_country: { type: "string" },
          species: { type: "string" },
          breed: { type: "string" },
        },
        required: ["carrier_code", "origin_country", "destination_country", "species"],
      },
    },
    {
      name: "emit_flight_proposal",
      description:
        "Terminal: propose one or more feasible flight dates. Each option names the carrier, route, cabin class, crate code, and flags any embargo exemptions required.",
      input_schema: {
        type: "object" as const,
        properties: {
          case_id: { type: "string" },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                carrier_code: { type: "string" },
                route: { type: "string", description: "IATA airport codes joined by '-' (e.g. DXB-LHR)." },
                depart_date: { type: "string", description: "ISO date (YYYY-MM-DD)." },
                cabin: { type: "string", enum: [...CABIN_CLASSES] },
                crate_code: { type: "string", enum: [...CRATE_CODES] },
                requires_embargo_waiver: { type: "boolean" },
                notes: { type: "string" },
              },
              required: ["carrier_code", "route", "depart_date", "cabin", "crate_code"],
            },
            minItems: 1,
          },
        },
        required: ["case_id", "options"],
      },
    },
    {
      name: "no_route_available",
      description:
        "Terminal: no feasible route within the target window. Escalates to the orchestrator so Comms can propose a new window to the owner.",
      input_schema: {
        type: "object" as const,
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          next_feasible_date: { type: "string", description: "ISO date; earliest the route re-opens." },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: ["emit_flight_proposal", "no_route_available"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
