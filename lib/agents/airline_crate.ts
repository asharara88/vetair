// Airline & Crate — selects a flight + IATA LAR compliant crate.
// Second voice in the consensus timeline loop. Cross-checks the vet_network
// and endorsement proposals against actual cargo availability + embargoes.

import { type AgentDefinition, validateAgent } from "./types";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "IATA LAR + CR-82 sizing, route selection, breed embargo and temperature checks. Proposes a flight + crate spec for the consensus timeline.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "read_pet_facts",
      description:
        "Read the pet row including breed and weight (drives crate sizing) and any noted snub-nosed / restricted breed flags.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_case",
      description: "Read corridor, target_date window, and earliest_legal_departure.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "list_routes",
      description:
        "List flight routes between origin and destination that accept live animals as cargo. Includes carrier, route_code, embargo flags, max transit hours.",
      input_schema: {
        type: "object",
        properties: {
          origin_country: { type: "string" },
          destination_country: { type: "string" },
          species: { type: "string" },
        },
        required: ["origin_country", "destination_country", "species"],
      },
    },
    {
      name: "check_breed_embargo",
      description:
        "Check if a carrier has a breed-specific embargo (e.g. snub-nosed dogs in summer). Returns blocking_reason or null.",
      input_schema: {
        type: "object",
        properties: {
          carrier: { type: "string" },
          breed: { type: "string" },
          season_month: { type: "integer", minimum: 1, maximum: 12 },
        },
        required: ["carrier", "breed"],
      },
    },
    {
      name: "compute_crate_spec",
      description:
        "Compute the CR-82 crate size for a pet's weight and shoulder height per IATA LAR. Returns recommended IATA size code (e.g. 'No. 300') and inner dimensions.",
      input_schema: {
        type: "object",
        properties: {
          species: { type: "string" },
          weight_kg: { type: "number" },
          shoulder_height_cm: { type: "number" },
        },
        required: ["species", "weight_kg"],
      },
    },
    {
      name: "read_cargo_availability",
      description:
        "Check cargo availability for a specific flight/date. Pet space on cargo holds is finite and ahead-bookings sell out 6–8 weeks before peak season.",
      input_schema: {
        type: "object",
        properties: {
          route_code: { type: "string" },
          date: { type: "string", description: "ISO YYYY-MM-DD" },
        },
        required: ["route_code", "date"],
      },
    },
    {
      name: "propose_flight",
      description:
        "Terminal: propose a single flight + crate spec for the consensus round. Orchestrator weighs against vet_network and endorsement proposals.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier: { type: "string" },
          route_code: { type: "string" },
          flight_date: { type: "string", description: "ISO YYYY-MM-DD" },
          crate_size_code: { type: "string" },
          crate_inner_dimensions_cm: {
            type: "object",
            properties: {
              length: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
            },
            required: ["length", "width", "height"],
          },
          cited_rules: { type: "array", items: { type: "string" } },
        },
        required: ["case_id", "carrier", "route_code", "flight_date", "crate_size_code", "cited_rules"],
      },
    },
    {
      name: "book_flight",
      description:
        "Terminal: confirm the flight after the orchestrator settles the consensus date. Writes to flight_bookings with status='booked'.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier: { type: "string" },
          route_code: { type: "string" },
          flight_date: { type: "string", description: "ISO YYYY-MM-DD" },
          crate_size_code: { type: "string" },
        },
        required: ["case_id", "carrier", "route_code", "flight_date", "crate_size_code"],
      },
    },
    {
      name: "fail_booking",
      description:
        "Terminal: no compliant route within the target window (embargo, no capacity, transit-hours violation). Flags for exception_handler.",
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
  terminal_tools: ["propose_flight", "book_flight", "fail_booking"],
  budget: { max_turns: 8, max_input_tokens: 50_000 },
});
