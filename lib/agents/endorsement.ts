// Endorsement — pre-flight government endorsement window timing.
// Voice 3 of 3 in the timeline consensus loop. Owns the 7–10 day MOCCAE/APHA
// stamp window: the health certificate must be issued AFTER the vet exam and
// BEFORE the flight, with the endorsement authority's submission lead time
// respected (courier transit, electronic submission cutoffs).

import { type AgentDefinition, validateAgent } from "./types";
import { ACKNOWLEDGE_AND_WAIT_TOOL, CASE_ID_INPUT } from "./shared-tools";

const ENDORSEMENT_AUTHORITIES = ["MOCCAE", "APHA", "USDA_APHIS", "CFIA"] as const;

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement Desk",
  description:
    "Pre-flight government endorsement window timing (MOCCAE / APHA / USDA / CFIA). Voice 3 of 3 in the timeline consensus loop.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_country_rules",
      description: "Read country_rules to look up the endorsement window + lead time for the corridor + species.",
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
      name: "read_assessment",
      description: "Read the most recent compliance assessment for the case.",
      input_schema: CASE_ID_INPUT,
    },
    {
      name: "read_proposed_flight",
      description:
        "Read the most recent airline_crate proposal so the endorsement window can be aligned with the flight date.",
      input_schema: CASE_ID_INPUT,
    },
    {
      name: "read_proposed_vet_exam",
      description:
        "Read the most recent vet_network proposal so the endorsement window starts after the health exam.",
      input_schema: CASE_ID_INPUT,
    },
    {
      name: "propose_endorsement",
      description:
        "Terminal: propose a submission date and authority. Must satisfy: vet_exam_date < submission_date < flight_date AND submission_date within the authority's pre-flight window.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: [...ENDORSEMENT_AUTHORITIES] },
          submission_date: { type: "string", description: "ISO date (YYYY-MM-DD)" },
          courier: {
            type: "string",
            enum: ["electronic", "in_person", "courier"],
            description: "How the certificate moves to the endorsement authority.",
          },
          rationale: { type: "string" },
          cited_rules: { type: "array", items: { type: "string" } },
        },
        required: ["case_id", "authority", "submission_date", "courier", "rationale"],
      },
    },
    {
      name: "flag_window_infeasible",
      description:
        "Terminal: the endorsement window cannot be aligned with the proposed flight date (e.g. vet exam too late, embassy closure, courier transit).",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          suggested_target_date: {
            type: "string",
            description: "ISO date the orchestrator should propose to the owner instead.",
          },
        },
        required: ["case_id", "reason"],
      },
    },
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: ["propose_endorsement", "flag_window_infeasible", "acknowledge_and_wait"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
