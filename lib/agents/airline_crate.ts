// Airline & Crate — IATA LAR + CR-82 sizing + route selection + embargo check.
// Emits a proposed routing into the consensus timeline loop; the orchestrator
// votes it against the vet and endorsement proposals before booking is locked.

import { type AgentDefinition, validateAgent } from "./types";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "IATA LAR + CR-82 sizing. Picks carrier and route, sizes the crate, checks the temperature embargo for the corridor.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "read_pet_facts",
      description: "Read the case's pet row. Species, weight, and breed drive crate sizing and snub-nose restrictions.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_iata_carriers",
      description:
        "Read approved carriers for the corridor + species. Returns carrier code, hub airports, snub-nose policy, and live-animal acceptance windows.",
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
      name: "check_temperature_embargo",
      description:
        "Check seasonal hot/cold embargoes at origin, destination, and any transit hub. Returns embargo windows and the nearest legal departure if blocked.",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string" },
          destination: { type: "string" },
          target_date: { type: "string", description: "ISO YYYY-MM-DD" },
          transit_hubs: {
            type: "array",
            items: { type: "string" },
            description: "IATA codes of intermediate stops on the proposed routing.",
          },
        },
        required: ["origin", "destination", "target_date"],
      },
    },
    {
      name: "compute_crate",
      description:
        "Compute IATA CR-82 crate size and code from species + weight (+ optional length/height). Output is authoritative — derived deterministically, not guessed.",
      input_schema: {
        type: "object",
        properties: {
          species: { type: "string" },
          weight_kg: { type: "number", minimum: 0 },
          length_cm: { type: "number", minimum: 0 },
          height_cm: { type: "number", minimum: 0 },
        },
        required: ["species", "weight_kg"],
      },
    },
    {
      name: "propose_routing",
      description:
        "Terminal: emit a proposed routing for the consensus round. carrier_code + route + depart_date + crate_code are required; the orchestrator votes this against the vet + endorsement proposals.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier_code: { type: "string", description: "IATA carrier code, e.g. EK, BA, LH" },
          route: {
            type: "array",
            items: { type: "string" },
            description: "Ordered IATA airport codes, e.g. ['DXB', 'LHR']",
            minItems: 2,
          },
          depart_date: { type: "string", description: "ISO YYYY-MM-DD" },
          crate_code: { type: "string", description: "IATA CR-82 size code, e.g. PP30, PP40, PP50" },
          unaccompanied: {
            type: "boolean",
            description: "true for cargo/manifest, false for in-cabin or AVIH excess baggage.",
          },
        },
        required: ["case_id", "carrier_code", "route", "depart_date", "crate_code"],
      },
    },
    {
      name: "escalate_no_route",
      description:
        "Terminal: no legal routing within the owner's target window (embargo blocked, breed banned by every approved carrier, or no live-animal acceptance).",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_legal_departure: {
            type: "string",
            description: "ISO YYYY-MM-DD — the soonest date a legal routing becomes available, if known.",
          },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: ["propose_routing", "escalate_no_route"],
  budget: { max_turns: 6, max_input_tokens: 50_000 },
});
