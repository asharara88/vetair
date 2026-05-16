// Airline & Crate — picks an IATA-compliant flight, sizes the crate to CR-82,
// and checks temperature embargoes on the route.

import { type AgentDefinition, validateAgent } from "./types";

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate",
  description:
    "Picks an IATA-compliant flight, sizes the crate to CR-82 (IATA LAR), and checks temperature embargoes along the route. Snub-nosed breeds trigger brachycephalic carrier filtering.",
  prompt_path: "lib/prompts/airline_crate.md",
  tools: [
    {
      name: "read_pet_facts",
      description: "Read the case's pet row (weight, breed, species) for crate sizing.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "size_crate",
      description:
        "Compute IATA CR-82 crate dimensions from pet measurements. Result rounds UP to the next standard IATA size.",
      input_schema: {
        type: "object",
        properties: {
          weight_kg: { type: "number" },
          snout_length_cm: { type: "number" },
          species: { type: "string" },
          breed: { type: "string" },
        },
        required: ["weight_kg", "species"],
      },
    },
    {
      name: "check_temperature_embargo",
      description:
        "Check whether the carrier has a heat/cold embargo on the route for the given date.",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string" },
          destination: { type: "string" },
          date: { type: "string" },
        },
        required: ["origin", "destination", "date"],
      },
    },
    {
      name: "list_routes",
      description:
        "List candidate routes for the corridor inside a date window. Use species=`brachycephalic_<species>` to filter snub-nosed-friendly carriers.",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string" },
          destination: { type: "string" },
          date_from: { type: "string" },
          date_to: { type: "string" },
          species: { type: "string" },
        },
        required: ["origin", "destination", "date_from", "date_to", "species"],
      },
    },
    {
      name: "emit_booking_plan",
      description:
        "Terminal: write the route + crate selection. Must cite the corridor requirement_code that governs carrier/crate choice.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          route: {
            type: "object",
            description: "Full Route object as returned by list_routes.",
          },
          crate_size: {
            type: "object",
            properties: {
              iata_size: { type: "string" },
              internal_l_cm: { type: "number" },
              internal_w_cm: { type: "number" },
              internal_h_cm: { type: "number" },
              ventilation_class: { type: "string" },
            },
            required: ["iata_size"],
          },
          carrier_id: { type: "string" },
          requirement_code: { type: "string" },
        },
        required: ["case_id", "route", "crate_size", "carrier_id", "requirement_code"],
      },
    },
    {
      name: "escalate_embargo",
      description:
        "Terminal: the corridor is under temperature embargo across the target window. Returns the next feasible date for the orchestrator to renegotiate with the owner.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          next_feasible_date: { type: "string" },
        },
        required: ["case_id", "reason", "next_feasible_date"],
      },
    },
  ],
  terminal_tools: ["emit_booking_plan", "escalate_embargo"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
