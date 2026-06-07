// Airline & Crate — picks the route and locks the crate.
// Reasons over IATA LAR + CR-82 sizing, current embargo windows, and the
// airline's own pet-policy quirks. Proposes routings into the consensus
// timeline; doesn't book unilaterally.

import { type AgentDefinition, validateAgent } from "./types";
import { ASK_USER_FOR_INPUT_TOOL } from "./shared-tools";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "Selects route, airline and IATA-compliant crate. Reasons over LAR §1.3, CR-82 sizing, embargo windows and airline policy. Proposes options into the consensus timeline.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "read_pet_dimensions",
      description: "Read pet weight + measured dimensions for crate sizing. Returns weight_kg and {length_cm,height_cm,width_cm} if recorded.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "list_routes",
      description:
        "List candidate routes for a corridor on a target date window. Returns carrier, flight_number, route_legs[], cabin_or_cargo, pet_policy_url.",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string" },
          destination: { type: "string" },
          target_date: { type: "string" },
          window_days: { type: "integer", minimum: 0, maximum: 30 },
          species: { type: "string" },
        },
        required: ["origin", "destination", "target_date"],
      },
    },
    {
      name: "read_embargoes",
      description:
        "Read active temperature / breed / route embargoes that intersect the candidate flights.",
      input_schema: {
        type: "object",
        properties: {
          carrier: { type: "string" },
          origin: { type: "string" },
          destination: { type: "string" },
          target_date: { type: "string" },
        },
        required: ["carrier", "origin", "destination", "target_date"],
      },
    },
    {
      name: "size_crate",
      description:
        "Compute the IATA CR-82 crate code from pet dimensions. Returns recommended series + interior dimensions and the corresponding LAR clause.",
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
      name: "propose_routing",
      description:
        "Terminal: propose ranked routing + crate options for the consensus timeline. Each option must cite the LAR/CR-82 clause that supports the crate choice.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          options: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                carrier: { type: "string" },
                flight_number: { type: "string" },
                depart_at: { type: "string", description: "ISO timestamp." },
                arrive_at: { type: "string", description: "ISO timestamp." },
                cabin_or_cargo: { type: "string", enum: ["cabin", "cargo"] },
                crate_code: { type: "string", description: "e.g. CR-82, IATA series 200." },
                cited_lar_clause: { type: "string" },
                estimated_cost_usd: { type: "number" },
                notes: { type: "string" },
              },
              required: [
                "carrier",
                "flight_number",
                "depart_at",
                "cabin_or_cargo",
                "crate_code",
                "cited_lar_clause",
              ],
            },
          },
        },
        required: ["case_id", "options"],
      },
    },
    {
      name: "confirm_booking",
      description:
        "Terminal: confirm the routing the orchestrator selected after consensus. Records carrier + flight + crate + cost.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier: { type: "string" },
          flight_number: { type: "string" },
          depart_at: { type: "string" },
          crate_code: { type: "string" },
          cited_lar_clause: { type: "string" },
        },
        required: ["case_id", "carrier", "flight_number", "depart_at", "crate_code", "cited_lar_clause"],
      },
    },
    ASK_USER_FOR_INPUT_TOOL,
    {
      name: "no_routing_available",
      description:
        "Terminal: no feasible carrier + crate combination for the corridor and date window. Returns the binding constraint.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          binding_constraint: { type: "string", description: "Plain summary of the constraint, e.g. heat embargo through Sep 30." },
          earliest_legal_alternative: { type: "string", description: "ISO date if a later window would work." },
        },
        required: ["case_id", "binding_constraint"],
      },
    },
  ],
  terminal_tools: [
    "propose_routing",
    "confirm_booking",
    "ask_user_for_input",
    "no_routing_available",
  ],
  budget: { max_turns: 8, max_input_tokens: 60_000 },
});
