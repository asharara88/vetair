// Endorsement — schedules the 10-day-pre-flight health certificate endorsement.
// MOCCAE for UAE-origin, APHA for UK-origin, USDA for US-origin, etc. Proposes
// a submission window the consensus loop checks against the chosen flight.

import { type AgentDefinition, validateAgent } from "./types";
import {
  ACKNOWLEDGE_AND_WAIT_TOOL,
  READ_ASSESSMENT_TOOL,
  READ_CASE_TOOL,
} from "./shared-tools";

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement Desk",
  description:
    "Schedules the 10-day pre-flight health certificate endorsement with the right competent authority (MOCCAE / APHA / USDA / DEFRA / EU TRACES).",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    READ_CASE_TOOL,
    READ_ASSESSMENT_TOOL,
    {
      name: "lookup_authority",
      description:
        "Look up the competent authority for an origin country + destination corridor. Returns {authority_code, submission_channel, lead_days, valid_window_days}.",
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
      name: "read_courier_slas",
      description:
        "Read transit SLAs for couriers between the issuing authority and the airport of departure. Used to pad submission lead time.",
      input_schema: {
        type: "object",
        properties: {
          authority_code: { type: "string" },
          airport_code: { type: "string" },
        },
        required: ["authority_code", "airport_code"],
      },
    },
    {
      name: "propose_endorsement_plan",
      description:
        "Terminal: emit the proposed submission + courier plan to the consensus round. window_open and window_close must bracket the chosen flight date by no more than the authority's valid_window_days.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority_code: { type: "string" },
          submission_channel: { type: "string", enum: ["in_person", "courier", "traces", "vehs", "e_cert"] },
          window_open: { type: "string", description: "ISO date (YYYY-MM-DD) — earliest submission." },
          window_close: { type: "string", description: "ISO date (YYYY-MM-DD) — latest submission." },
          courier: { type: "string" },
          courier_pickup_date: { type: "string" },
          requirement_codes: {
            type: "array",
            items: { type: "string" },
            description: "requirement_codes this endorsement satisfies.",
          },
        },
        required: ["case_id", "authority_code", "submission_channel", "window_open", "window_close", "requirement_codes"],
      },
    },
    {
      name: "endorsement_infeasible",
      description:
        "Terminal: the authority's lead time + courier SLA cannot land the endorsement on the chosen flight date. Provide the binding constraint.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_feasible_flight: { type: "string", description: "ISO date." },
        },
        required: ["case_id", "reason"],
      },
    },
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: [
    "propose_endorsement_plan",
    "endorsement_infeasible",
    "acknowledge_and_wait",
  ],
  budget: { max_turns: 5, max_input_tokens: 30_000 },
});
