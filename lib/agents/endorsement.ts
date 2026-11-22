// Endorsement — drives the 10-day window: schedules the OV appointment,
// submits the health certificate packet to the destination's competent
// authority (MOCCAE for UAE, APHA for UK, USDA for US), tracks the physical
// courier when the authority still requires wet-ink.

import { type AgentDefinition, type AgentTool, validateAgent } from "./types";

const AUTHORITIES = ["MOCCAE", "APHA", "USDA", "BORDER_INSPECTION_POINT"] as const;

const READ_TOOLS: AgentTool[] = [
  {
    name: "read_case",
    description:
      "Read the case row — corridor, target_date, earliest_legal_departure, service_tier.",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  },
  {
    name: "read_requirements",
    description:
      "Read requirement_evaluations for the case — specifically endorsement- and permit-typed rules and their time_constraints.",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  },
  {
    name: "read_assessment",
    description: "Read the latest compliance assessment, including cited_rules.",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  },
  {
    name: "read_endorsement_window",
    description:
      "Return the destination authority's pre-flight endorsement window (min/max days) for the corridor. Driven by country_rules.time_constraints.",
    input_schema: {
      type: "object",
      properties: {
        destination_country: { type: "string" },
        species: { type: "string", enum: ["dog", "cat", "ferret"] },
      },
      required: ["destination_country", "species"],
    },
  },
];

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Drives the pre-flight endorsement window. Schedules the OV appointment, submits the packet to the competent authority (MOCCAE/APHA/USDA), and tracks the courier when wet-ink is still required.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    ...READ_TOOLS,
    {
      name: "schedule_endorsement_appointment",
      description:
        "Terminal: write the endorsement appointment into the active consensus_round. Date must fall inside the authority's endorsement window relative to the proposed flight_date.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: [...AUTHORITIES] },
          appointment_date: { type: "string", description: "YYYY-MM-DD" },
          vet_id: { type: "string", description: "Approved OV performing the exam." },
          cited_rules: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["case_id", "authority", "appointment_date", "cited_rules"],
      },
    },
    {
      name: "submit_endorsement_packet",
      description:
        "Terminal: submit the completed packet to the authority. Documents must be uploaded (id present in `documents` table) and the submission is logged for audit.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: [...AUTHORITIES] },
          document_ids: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
          },
          submission_reference: { type: "string" },
        },
        required: ["case_id", "authority", "document_ids"],
      },
    },
    {
      name: "track_courier",
      description:
        "Terminal: record a courier dispatch for wet-ink destinations. Stores tracking so Audit can watchdog the SLA.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          courier: { type: "string", enum: ["DHL", "FedEx", "Aramex", "UPS"] },
          tracking_number: { type: "string" },
          expected_delivery: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["case_id", "courier", "tracking_number"],
      },
    },
    {
      name: "flag_window_breach",
      description:
        "Terminal: the current flight_date cannot be endorsed within the authority's window. Orchestrator escalates to timeline re-consensus.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_feasible_flight: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["case_id", "reason"],
      },
    },
    {
      name: "acknowledge_and_wait",
      description: "Terminal: yield (packet already submitted, awaiting authority response, etc.).",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: [
    "schedule_endorsement_appointment",
    "submit_endorsement_packet",
    "track_courier",
    "flag_window_breach",
    "acknowledge_and_wait",
  ],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
