// Airline & Crate — IATA LAR / CR-82 sizing, route selection, embargo checks.
// Proposes a flight + crate spec; participates in the timeline consensus round.

import { type AgentDefinition, validateAgent } from "./types";
import { ACKNOWLEDGE_AND_WAIT_TOOL } from "./shared-tools";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "IATA LAR routing, CR-82 crate sizing, temperature-embargo screening. Proposes flight + crate options that respect the earliest legal departure and the owner's target window.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "read_pet_facts",
      description: "Read the case's pet row (species, breed, weight) so crate sizing and breed-snub embargoes can be applied.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_case_window",
      description: "Read the case's target_date, earliest_legal_departure, and owner's locale.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "list_airline_routes",
      description: "Read airline_routes filtered by corridor + species, including IATA pet-policy + embargo windows.",
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
      name: "compute_crate_spec",
      description: "Run the deterministic CR-82 sizing function for a given pet (returns recommended crate dimensions + IATA size code).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "propose_flight",
      description: "Propose (do not commit) a flight + crate slate. Adds it to the consensus round payload.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          airline: { type: "string" },
          flight_number: { type: "string" },
          depart_date: { type: "string", description: "YYYY-MM-DD" },
          route: { type: "array", items: { type: "string" } },
          crate_size_code: { type: "string" },
          quote_amount_usd: { type: "number" },
          notes: { type: "string" },
        },
        required: ["case_id", "airline", "depart_date", "crate_size_code"],
      },
    },
    {
      name: "book_flight",
      description: "Terminal: lock the booking once the timeline consensus has resolved. Writes the bookings row.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          airline: { type: "string" },
          flight_number: { type: "string" },
          depart_date: { type: "string", description: "YYYY-MM-DD" },
          route: { type: "array", items: { type: "string" } },
          crate_size_code: { type: "string" },
        },
        required: ["case_id", "airline", "depart_date", "crate_size_code"],
      },
    },
    {
      name: "embargo_block",
      description: "Terminal: corridor is on a temperature / breed embargo. Hands the case back to the Orchestrator for owner re-routing.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          embargo_type: { type: "string", enum: ["temperature", "breed", "size", "country", "other"] },
          reason: { type: "string" },
        },
        required: ["case_id", "embargo_type", "reason"],
      },
    },
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: ["book_flight", "embargo_block", "acknowledge_and_wait"],
  budget: { max_turns: 8, max_input_tokens: 60_000 },
});
