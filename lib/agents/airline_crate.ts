// Airline & Crate — IATA LAR routing, CR-82 crate sizing, temperature embargo.
// Proposes flight dates into the timeline consensus loop.

import { type AgentDefinition, validateAgent } from "./types";
import { PROPOSE_DATES_TOOL } from "./shared-tools";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "IATA Live Animal Regulations: CR-82 crate sizing, route + carrier selection, seasonal temperature embargo. Proposes flight dates into the timeline consensus loop.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "compute_crate_size",
      description:
        "Compute the IATA CR-82 minimum crate dimensions for the pet. Returns size class (XS..XXL) and minimum interior L/W/H in cm.",
      input_schema: {
        type: "object",
        properties: {
          species: { type: "string" },
          breed: { type: "string" },
          weight_kg: { type: "number", minimum: 0.1, maximum: 100 },
          length_cm: { type: "number", minimum: 5, maximum: 200 },
          height_cm: { type: "number", minimum: 5, maximum: 200 },
        },
        required: ["species", "weight_kg"],
      },
    },
    {
      name: "list_routes",
      description:
        "List candidate carrier + route combinations for a corridor inside a target window. Filters by IATA-approved animal carriers only.",
      input_schema: {
        type: "object",
        properties: {
          origin_airport: { type: "string", description: "IATA code, e.g. DXB" },
          destination_airport: { type: "string", description: "IATA code, e.g. LHR" },
          window_start: { type: "string", description: "ISO YYYY-MM-DD" },
          window_end: { type: "string", description: "ISO YYYY-MM-DD" },
          crate_size_class: { type: "string", enum: ["XS", "S", "M", "L", "XL", "XXL"] },
        },
        required: ["origin_airport", "destination_airport", "window_start", "window_end"],
      },
    },
    {
      name: "check_temperature_embargo",
      description:
        "Check whether a carrier + route is under a heat or cold embargo for a flight date. Carriers refuse live animals when forecast/historic ground temps fall outside their permitted range.",
      input_schema: {
        type: "object",
        properties: {
          carrier: { type: "string" },
          origin_airport: { type: "string" },
          destination_airport: { type: "string" },
          flight_date: { type: "string", description: "ISO YYYY-MM-DD" },
        },
        required: ["carrier", "origin_airport", "destination_airport", "flight_date"],
      },
    },
    {
      name: "read_pet_facts",
      description: "Read the case's pet row (species, breed, weight, dimensions if known).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    PROPOSE_DATES_TOOL,
    {
      name: "lock_route",
      description:
        "Terminal: lock a carrier + flight + crate size for the case. Provisional until the orchestrator's consensus round confirms the full timeline.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier: { type: "string" },
          flight_number: { type: "string" },
          flight_at: { type: "string", description: "ISO timestamp" },
          crate_size_class: { type: "string", enum: ["XS", "S", "M", "L", "XL", "XXL"] },
          crate_dimensions_cm: {
            type: "object",
            properties: {
              length: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
            },
            required: ["length", "width", "height"],
          },
        },
        required: ["case_id", "carrier", "flight_number", "flight_at", "crate_size_class"],
      },
    },
    {
      name: "escalate_no_route",
      description:
        "Terminal: no compliant carrier + route exists in the target window (snub-nose breed restriction, embargo, no animal-cleared aircraft). Orchestrator decides next step.",
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
  terminal_tools: ["propose_dates", "lock_route", "escalate_no_route"],
  budget: { max_turns: 8, max_input_tokens: 50_000 },
});
