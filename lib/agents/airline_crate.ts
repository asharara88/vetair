// Airline & Crate — IATA LAR breed lookup, CR-82 crate sizing, route selection,
// temperature embargo. Proposes a flight + crate spec into the consensus timeline.

import { type AgentDefinition, validateAgent } from "./types";
import {
  ACKNOWLEDGE_AND_WAIT_TOOL,
  READ_CASE_TOOL,
  READ_PET_FACTS_TOOL,
} from "./tools-shared";

const CRATE_SIZE_CODES = ["100", "200", "300", "400", "500", "550", "600", "700"] as const;

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "IATA LAR breed lookup, CR-82 crate sizing, embargo-aware route selection. Proposes a single feasible flight + crate spec.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    READ_CASE_TOOL,
    READ_PET_FACTS_TOOL,
    {
      name: "lookup_iata_lar",
      description:
        "Read IATA Live Animals Regulations flags for a species + breed. Returns brachycephalic warning, snub-nosed embargo notes, age minimums.",
      input_schema: {
        type: "object",
        properties: {
          species: { type: "string" },
          breed: { type: "string" },
        },
        required: ["species", "breed"],
      },
    },
    {
      name: "compute_crate_size",
      description:
        "Compute the CR-82 IATA container size code from pet measurements. A+B+½C ≥ length; height ≥ standing-head clearance.",
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
      name: "list_carriers",
      description:
        "Return carriers that operate the corridor on the target date with live-animal capacity. Excludes embargoed routes (heat/cold).",
      input_schema: {
        type: "object",
        properties: {
          origin_airport: { type: "string" },
          destination_airport: { type: "string" },
          target_date: { type: "string", description: "YYYY-MM-DD" },
          crate_size_code: { type: "string", enum: [...CRATE_SIZE_CODES] },
        },
        required: ["origin_airport", "destination_airport", "target_date"],
      },
    },
    {
      name: "propose_route",
      description:
        "Terminal: emit a single proposed itinerary. Orchestrator runs a consensus round against this proposal alongside Vet Network and Endorsement.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier: { type: "string" },
          flight_no: { type: "string" },
          depart_iso: { type: "string" },
          arrive_iso: { type: "string" },
          crate_size_code: { type: "string", enum: [...CRATE_SIZE_CODES] },
          cited_lar: {
            type: "array",
            items: { type: "string" },
            description: "IATA LAR clauses backing breed/crate decisions.",
          },
        },
        required: [
          "case_id",
          "carrier",
          "flight_no",
          "depart_iso",
          "arrive_iso",
          "crate_size_code",
          "cited_lar",
        ],
      },
    },
    {
      name: "flag_embargo",
      description:
        "Terminal: no feasible route exists for the target window (snub-nosed ban, heat embargo, no live-animal capacity). Returns the next feasible date if known.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_feasible_date: { type: "string", description: "YYYY-MM-DD; null if unknown." },
        },
        required: ["case_id", "reason"],
      },
    },
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: ["propose_route", "flag_embargo", "acknowledge_and_wait"],
  budget: { max_turns: 6, max_input_tokens: 50_000 },
});
