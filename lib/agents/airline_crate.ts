// Airline & Crate — picks a feasible cargo routing and sizes a CR-82 crate.

import { type AgentDefinition, validateAgent } from "./types";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "IATA LAR + CR-82 crate sizing, route selection, temperature embargo windows. Picks the first feasible cargo path for the target date.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "read_approved_carriers",
      description: "List approved cargo carriers for a corridor and species.",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string", description: "ISO-3166 alpha-2 origin country" },
          destination: { type: "string", description: "ISO-3166 alpha-2 destination country" },
          species: { type: "string", enum: ["dog", "cat", "ferret"] },
        },
        required: ["origin", "destination", "species"],
      },
    },
    {
      name: "read_embargo_calendar",
      description:
        "Read seasonal / breed embargo blocks for a carrier + route inside a window.",
      input_schema: {
        type: "object",
        properties: {
          carrier: { type: "string" },
          route: { type: "string", description: "ORIG-DEST IATA code pair, e.g. DXB-LHR" },
          window_start: { type: "string", description: "ISO date YYYY-MM-DD" },
          window_end: { type: "string", description: "ISO date YYYY-MM-DD" },
        },
        required: ["carrier", "route", "window_start", "window_end"],
      },
    },
    {
      name: "size_crate",
      description: "Compute a CR-82-compliant crate spec from pet measurements.",
      input_schema: {
        type: "object",
        properties: {
          species: { type: "string", enum: ["dog", "cat", "ferret"] },
          breed: { type: "string" },
          weight_kg: { type: "number", minimum: 0.1 },
          height_at_shoulder_cm: { type: "number", minimum: 1 },
          length_cm: { type: "number", minimum: 1 },
        },
        required: ["species", "weight_kg", "height_at_shoulder_cm", "length_cm"],
      },
    },
    {
      name: "propose_routing",
      description:
        "Soft-hold a flight + crate combination. Owner sees it via Comms. Reversible.",
      input_schema: {
        type: "object",
        properties: {
          carrier: { type: "string" },
          flight_number: { type: "string" },
          dep_iso: { type: "string", description: "Departure ISO timestamp with TZ" },
          arr_iso: { type: "string", description: "Arrival ISO timestamp with TZ" },
          crate_spec_id: { type: "string" },
        },
        required: ["carrier", "flight_number", "dep_iso", "arr_iso", "crate_spec_id"],
      },
    },
    {
      name: "book_routing",
      description: "Confirm a previously proposed routing. Irreversible.",
      input_schema: {
        type: "object",
        properties: { proposal_id: { type: "string" } },
        required: ["proposal_id"],
      },
    },
    {
      name: "emit_routing_plan",
      description:
        "Terminal: emit the selected routing + crate plan. Cited requirement_codes must appear in {{country_rules}}.",
      input_schema: {
        type: "object",
        properties: {
          carrier: { type: "string" },
          flight_number: { type: "string" },
          dep_iso: { type: "string" },
          arr_iso: { type: "string" },
          crate_spec_id: { type: "string" },
          requirement_codes: { type: "array", items: { type: "string" } },
          notes: { type: "string" },
        },
        required: ["carrier", "flight_number", "dep_iso", "arr_iso", "crate_spec_id", "requirement_codes"],
      },
    },
    {
      name: "escalate_no_feasible_path",
      description:
        "Terminal: abort. Use when no approved carrier offers a non-embargoed, CR-82-compliant routing in the target window.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: ["emit_routing_plan", "escalate_no_feasible_path"],
  budget: { max_turns: 8, max_input_tokens: 50_000 },
});
