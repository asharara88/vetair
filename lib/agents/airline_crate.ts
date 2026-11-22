// Airline & Crate — picks a route and IATA LAR-compliant crate for the pet.
// Reads pet dimensions + corridor + embargo rules; proposes a flight date and
// crate size (CR-82). Writes the proposal into the consensus round that the
// Orchestrator's timeline loop reconciles with Vet Network and Endorsement.

import { type AgentDefinition, type AgentTool, validateAgent } from "./types";

const CABIN_CLASS = ["cargo_manifest", "excess_baggage", "cabin_approved"] as const;

const READ_TOOLS: AgentTool[] = [
  {
    name: "read_case",
    description:
      "Read the case row — origin, destination, target_date, earliest_legal_departure, service_tier.",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  },
  {
    name: "read_pet_facts",
    description: "Read the pet row (species, breed, weight_kg, body dimensions if captured).",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  },
  {
    name: "lookup_iata_lar",
    description:
      "Look up the IATA Live Animals Regulations profile for a species (container standards, ventilation, labelling). Returns `container_requirement_code` plus per-airline deviations.",
    input_schema: {
      type: "object",
      properties: {
        species: { type: "string", enum: ["dog", "cat", "ferret"] },
        breed: { type: "string" },
      },
      required: ["species"],
    },
  },
  {
    name: "compute_crate_size",
    description:
      "Compute the IATA CR-82 crate code using the four measurements the standard requires: A (nose-to-root-of-tail), B (elbow-to-floor), C (shoulder width), D (head-to-floor in natural standing position — tip of ear for erect-eared breeds), plus weight. Returns `crate_code` + interior dimensions in cm.",
    input_schema: {
      type: "object",
      properties: {
        body_length_cm: { type: "number", description: "A — nose to root of tail." },
        elbow_to_floor_cm: { type: "number", description: "B — elbow joint to floor; used in the A + ½B length formula." },
        shoulder_width_cm: { type: "number", description: "C — width across the shoulders or widest point." },
        head_to_floor_cm: {
          type: "number",
          description:
            "D — top of head (or ear tip for erect-eared breeds) to floor in natural standing position. Interior height is derived from this, NEVER from shoulder height.",
        },
        weight_kg: { type: "number" },
      },
      required: ["body_length_cm", "elbow_to_floor_cm", "shoulder_width_cm", "head_to_floor_cm", "weight_kg"],
    },
  },
  {
    name: "list_routes",
    description:
      "Return approved routes for the corridor in the target window. Filters out airlines without live-animal acceptance for the species and dates inside a temperature embargo.",
    input_schema: {
      type: "object",
      properties: {
        origin_country: { type: "string" },
        destination_country: { type: "string" },
        species: { type: "string", enum: ["dog", "cat", "ferret"] },
        window_start: { type: "string", description: "YYYY-MM-DD" },
        window_end: { type: "string", description: "YYYY-MM-DD" },
        class: { type: "string", enum: [...CABIN_CLASS] },
      },
      required: ["origin_country", "destination_country", "species", "window_start", "window_end"],
    },
  },
];

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "Picks a route and IATA LAR-compliant crate for the pet. Enforces CR-82 sizing, temperature embargoes, and breed-specific carrier restrictions.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    ...READ_TOOLS,
    {
      name: "propose_booking_plan",
      description:
        "Terminal: write the booking proposal into the active consensus_round. Flight date must fall inside the case's target window and the crate_code must come from compute_crate_size — do not invent dimensions.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          route_id: { type: "string" },
          airline: { type: "string" },
          flight_date: { type: "string", description: "YYYY-MM-DD" },
          class: { type: "string", enum: [...CABIN_CLASS] },
          crate_code: { type: "string", description: "IATA CR-82 size code (e.g. PP50, VariKennel 500)." },
          price_estimate_usd: { type: "number" },
          cited_rules: {
            type: "array",
            items: { type: "string" },
            description: "requirement_codes this booking satisfies (e.g. carrier_rule, breed_restriction).",
          },
        },
        required: ["case_id", "route_id", "airline", "flight_date", "class", "crate_code", "cited_rules"],
      },
    },
    {
      name: "flag_embargo",
      description:
        "Terminal: the only feasible routes fall inside a temperature or seasonal embargo. Orchestrator will widen the window or escalate.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          airline: { type: "string" },
          embargo_window: {
            type: "object",
            properties: {
              start: { type: "string" },
              end: { type: "string" },
            },
            required: ["start", "end"],
          },
          reason: { type: "string" },
        },
        required: ["case_id", "embargo_window", "reason"],
      },
    },
    {
      name: "request_measurements",
      description:
        "Terminal: pet dimensions are missing and compute_crate_size cannot run. Ask Comms to prompt the owner for A/B/C measurements.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "acknowledge_and_wait",
      description: "Terminal: yield (e.g. compliance not yet approved, booking is premature).",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: ["propose_booking_plan", "flag_embargo", "request_measurements", "acknowledge_and_wait"],
  budget: { max_turns: 8, max_input_tokens: 60_000 },
});
