// Endorsement — the 7-to-10-day pre-flight window agent. Coordinates OV health
// certificate issuance + MOCCAE / APHA / DEFRA endorsement submission + courier
// return. The clock is tight: an endorsement issued too early is void; too late
// means missed flight. This agent exists to make sure the window is hit exactly
// once.

import { type AgentDefinition, validateAgent } from "./types";

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Runs the 7–10 day pre-flight endorsement window: OV health cert issuance, MOCCAE/APHA/DEFRA submission, courier tracking to the airport.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_flight_proposal",
      description: "Read the accepted flight proposal to anchor the endorsement window.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_vet_appointment",
      description: "Read the booked OV health-cert appointment from the vet_network step.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "compute_endorsement_window",
      description:
        "Deterministic helper. Given departure_date and the destination's rule (e.g. UAE: 7 days, UK: 10 days), returns the earliest and latest legal endorsement dates.",
      input_schema: {
        type: "object",
        properties: {
          departure_date: { type: "string", description: "ISO YYYY-MM-DD" },
          destination_country: { type: "string" },
          species: { type: "string" },
        },
        required: ["departure_date", "destination_country", "species"],
      },
    },
    {
      name: "schedule_endorsement",
      description: "Terminal: schedule the endorsement submission. Date must fall inside the window returned by compute_endorsement_window.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: {
            type: "string",
            enum: ["MOCCAE_UAE", "APHIS_USDA", "APHA_UK", "DGAV_PT", "DGAL_FR", "other"],
          },
          submission_date: { type: "string", description: "ISO YYYY-MM-DD" },
          courier: { type: "string", description: "Courier to return the endorsed certificate." },
          cited_rules: {
            type: "array",
            items: { type: "string" },
            description: "Requirement codes defining the window (e.g. UK-DOG-004-ENDORSE-10DAYS).",
            minItems: 1,
          },
        },
        required: ["case_id", "authority", "submission_date", "cited_rules"],
      },
    },
    {
      name: "request_vet_appointment",
      description: "Terminal: the OV appointment required for the health cert is missing or outside the window. Hands back to vet_network.",
      input_schema: {
        type: "object",
        properties: {
          reason: { type: "string" },
          required_before: { type: "string", description: "ISO YYYY-MM-DD the appointment must precede." },
        },
        required: ["reason", "required_before"],
      },
    },
    {
      name: "window_infeasible",
      description: "Terminal: no feasible submission date exists (e.g. departure date leaves <2 business days of window). Escalates to human.",
      input_schema: {
        type: "object",
        properties: {
          reason: { type: "string" },
          earliest_legal: { type: "string", description: "ISO YYYY-MM-DD" },
          latest_legal: { type: "string", description: "ISO YYYY-MM-DD" },
        },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: ["schedule_endorsement", "request_vet_appointment", "window_infeasible"],
  budget: { max_turns: 5, max_input_tokens: 40_000 },
});
