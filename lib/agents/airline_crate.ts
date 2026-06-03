// Airline & Crate — selects an IATA-compliant route + airline, sizes the
// CR-82 crate from the pet's dimensions, and flags temperature embargoes.

import { type AgentDefinition, type AgentTool, validateAgent } from "./types";

const TOOLS: AgentTool[] = [
  {
    name: "read_pet_dimensions",
    description: "Read pet weight + measurements (length, height, width at shoulders) used for CR-82 sizing.",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  },
  {
    name: "read_corridor",
    description: "Read origin + destination + target_date so we can search airline schedules.",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  },
  {
    name: "search_routes",
    description:
      "List candidate routes (origin → destination) on or near the target_date. Each carries IATA carrier code, layover count, cargo policy class, and live temperature forecast for any layover airport.",
    input_schema: {
      type: "object",
      properties: {
        origin: { type: "string", description: "IATA airport code" },
        destination: { type: "string", description: "IATA airport code" },
        window_start: { type: "string", description: "YYYY-MM-DD inclusive" },
        window_end: { type: "string", description: "YYYY-MM-DD inclusive" },
        species: { type: "string" },
      },
      required: ["origin", "destination", "window_start", "window_end", "species"],
    },
  },
  {
    name: "compute_crate_size",
    description:
      "Compute the IATA CR-82 minimum crate dimensions from the pet's measurements. Returns crate code (100/200/300/400/500/600/700) and internal LxWxH.",
    input_schema: {
      type: "object",
      properties: {
        length_cm: { type: "number" },
        height_cm: { type: "number" },
        width_cm: { type: "number" },
        species: { type: "string" },
      },
      required: ["length_cm", "height_cm", "width_cm", "species"],
    },
  },
  {
    name: "emit_routing",
    description:
      "Terminal: lock the route + carrier + crate. `cited_rules[]` must reference any temperature/breed/carrier rule the choice satisfies.",
    input_schema: {
      type: "object",
      properties: {
        carrier_iata: { type: "string", description: "Two-letter IATA carrier code, e.g. EK, BA." },
        flight_segments: {
          type: "array",
          items: {
            type: "object",
            properties: {
              from_iata: { type: "string" },
              to_iata: { type: "string" },
              flight_number: { type: "string" },
              departs_at: { type: "string", description: "ISO 8601 datetime" },
              arrives_at: { type: "string", description: "ISO 8601 datetime" },
            },
            required: ["from_iata", "to_iata", "flight_number", "departs_at", "arrives_at"],
          },
          minItems: 1,
        },
        crate_code: {
          type: "string",
          enum: ["100", "200", "300", "400", "500", "600", "700"],
        },
        cited_rules: { type: "array", items: { type: "string" } },
        notes: { type: "string" },
      },
      required: ["carrier_iata", "flight_segments", "crate_code", "cited_rules"],
    },
  },
  {
    name: "flag_embargo",
    description: "Terminal: every candidate route is blocked by a temperature embargo, breed restriction, or cargo capacity constraint. Routes to Orchestrator.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string" },
        earliest_clear_date: { type: "string", description: "YYYY-MM-DD when an embargo lifts, if known." },
        cited_rules: { type: "array", items: { type: "string" } },
      },
      required: ["reason", "cited_rules"],
    },
  },
  {
    name: "fail_routing",
    description: "Terminal: no feasible route exists in the search window for reasons unrelated to a known embargo (no carrier flies the pair, no cargo space).",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string" } },
      required: ["reason"],
    },
  },
];

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "Selects an IATA-compliant route + carrier and sizes the CR-82 crate. Flags temperature embargoes before booking.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: TOOLS,
  terminal_tools: ["emit_routing", "flag_embargo", "fail_routing"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
