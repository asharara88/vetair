// Endorsement — files government endorsement papers within the 7–10 day window.
// Third voice in the consensus timeline loop. The endorsement window is the
// tightest constraint: most authorities require the health certificate be
// endorsed 7–10 days before flight (USDA APHIS, MOCCAE, DEFRA).

import { type AgentDefinition, validateAgent } from "./types";

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Files government endorsement papers (MOCCAE / APHA / DEFRA) within the 7–10 day pre-flight window. Tracks courier status.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_case",
      description: "Read corridor, target_date, earliest_legal_departure.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_assessment",
      description:
        "Read the latest compliance assessment so the endorsement window is anchored to the actual flight date and cited rules.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_documents",
      description:
        "Read the case's documents — endorsement requires a current health certificate signed by an accredited vet.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_endorsement_authority",
      description:
        "Read the endorsing authority for a destination corridor (e.g. UAE→US uses USDA APHIS VEHCS, UAE→UK uses DEFRA). Returns submission method, window days, processing days.",
      input_schema: {
        type: "object",
        properties: {
          origin_country: { type: "string" },
          destination_country: { type: "string" },
        },
        required: ["origin_country", "destination_country"],
      },
    },
    {
      name: "propose_window",
      description:
        "Terminal: propose the endorsement submission date for the consensus round, anchored to the proposed flight date and the authority's window.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string" },
          flight_date: { type: "string", description: "ISO YYYY-MM-DD anchor" },
          submission_date: { type: "string", description: "ISO YYYY-MM-DD" },
          window_basis: {
            type: "string",
            description: "Cite the requirement_code that defines the pre-flight window.",
          },
          cited_rules: { type: "array", items: { type: "string" } },
        },
        required: [
          "case_id",
          "authority",
          "flight_date",
          "submission_date",
          "window_basis",
          "cited_rules",
        ],
      },
    },
    {
      name: "submit_endorsement",
      description:
        "Terminal: submit the endorsement package after orchestrator confirms the consensus date. Writes endorsement_filings row, returns tracking info.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string" },
          submission_method: { type: "string", enum: ["portal", "courier", "in_person"] },
          courier_tracking_id: { type: "string" },
        },
        required: ["case_id", "authority", "submission_method"],
      },
    },
    {
      name: "fail_endorsement",
      description:
        "Terminal: cannot file (missing health certificate, expired vet credential, window infeasible). Flags for exception_handler.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: ["propose_window", "submit_endorsement", "fail_endorsement"],
  budget: { max_turns: 5, max_input_tokens: 40_000 },
});
