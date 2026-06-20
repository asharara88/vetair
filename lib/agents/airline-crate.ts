// Airline & Crate — IATA LAR + CR-82 sizing + temperature embargo windows.
// Proposes a flight + crate spec the corridor permits and the destination accepts.

import { type AgentDefinition, validateAgent } from "./types";
import { caseIdInput } from "./tool-schemas";

const SHIPPING_MODES = ["in_cabin", "checked_baggage", "manifest_cargo"] as const;

export const AIRLINE_CRATE: AgentDefinition = validateAgent({
  name: "airline_crate",
  type: "airline_crate",
  model: "claude-sonnet-4-6",
  user_facing_label: "Airline & Crate Team",
  description:
    "IATA LAR + CR-82 sizing + temperature embargo. Proposes a flight and crate spec the corridor permits and the destination accepts.",
  prompt_path: "lib/prompts/airline-crate.md",
  tools: [
    {
      name: "read_pet_dimensions",
      description:
        "Read pet weight + standing height + body length so CR-82 sizing can be computed. Returns nulls if not yet measured.",
      input_schema: caseIdInput(),
    },
    {
      name: "read_assessment",
      description:
        "Read the most recent compliance assessment to learn the corridor + earliest_legal_departure.",
      input_schema: caseIdInput(),
    },
    {
      name: "list_approved_carriers",
      description:
        "Read the carrier directory filtered by corridor + species + shipping mode. Each row carries embargo windows and crate-spec attestations.",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string" },
          destination: { type: "string" },
          species: { type: "string" },
          shipping_mode: { type: "string", enum: [...SHIPPING_MODES] },
        },
        required: ["origin", "destination", "species"],
      },
    },
    {
      name: "compute_crate_spec",
      description:
        "Apply IATA CR-82: returns the minimum crate dimensions (cm) given the pet's standing height and body length. Use this — do not guess.",
      input_schema: {
        type: "object",
        properties: {
          standing_height_cm: { type: "number", minimum: 1 },
          body_length_cm: { type: "number", minimum: 1 },
          shoulder_width_cm: { type: "number", minimum: 1 },
        },
        required: ["standing_height_cm", "body_length_cm", "shoulder_width_cm"],
      },
    },
    {
      name: "check_route_embargo",
      description:
        "Check whether the carrier embargoes pet shipments on the proposed route during the target date. Returns embargo windows if any apply.",
      input_schema: {
        type: "object",
        properties: {
          carrier_iata: { type: "string" },
          origin_iata: { type: "string" },
          destination_iata: { type: "string" },
          target_date: { type: "string" },
        },
        required: ["carrier_iata", "origin_iata", "destination_iata", "target_date"],
      },
    },
    {
      name: "propose_flight",
      description:
        "Terminal: lock a tentative flight + crate spec. Quote is informational; ticketing happens on owner confirmation.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          carrier_iata: { type: "string" },
          flight_number: { type: "string" },
          shipping_mode: { type: "string", enum: [...SHIPPING_MODES] },
          depart_at: { type: "string" },
          origin_iata: { type: "string" },
          destination_iata: { type: "string" },
          crate_spec: {
            type: "object",
            properties: {
              length_cm: { type: "number" },
              width_cm: { type: "number" },
              height_cm: { type: "number" },
              iata_class: { type: "string", enum: ["CR-82"] },
            },
            required: ["length_cm", "width_cm", "height_cm", "iata_class"],
          },
          quote_amount_usd: { type: "number", minimum: 0 },
          cited_rules: { type: "array", items: { type: "string" } },
        },
        required: [
          "case_id",
          "carrier_iata",
          "flight_number",
          "shipping_mode",
          "depart_at",
          "origin_iata",
          "destination_iata",
          "crate_spec",
          "quote_amount_usd",
          "cited_rules",
        ],
      },
    },
    {
      name: "fail_routing",
      description:
        "Terminal: no compliant carrier+date combination exists. Reason MUST cite the binding constraint (embargo, breed restriction, missing CR-82 dimensions).",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          binding_requirement_code: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: ["propose_flight", "fail_routing"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
