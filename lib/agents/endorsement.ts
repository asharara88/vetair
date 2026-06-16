// Endorsement — coordinates official paper endorsement of the case's health
// certificate (USDA APHIS, MOCCAE, DEFRA OV, etc.) once Compliance has emitted
// an `approved` or `pending` verdict that lists an endorsement-class missing
// requirement. The agent does not invent authorities — it reads the corridor
// rules to pick the right one.

import { type AgentDefinition, validateAgent } from "./types";
import {
  acknowledgeAndWaitTool,
  readAssessmentTool,
  readCaseTool,
} from "./shared-tools";

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement Team",
  description:
    "Coordinates official endorsement of the case's health certificate by the corridor's competent authority (USDA APHIS, MOCCAE, DEFRA OV equivalent). Schedules, tracks, and records outcome.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    readCaseTool("Read the case's origin/destination + target travel window."),
    readAssessmentTool(
      "Read the latest assessment so you only act on endorsement-class requirement_codes that the primary cited.",
    ),
    {
      name: "read_documents",
      description: "Read uploaded documents. Endorsement is meaningless without a health certificate on file.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "list_endorsing_authorities",
      description:
        "List the competent authorities for the origin country (USDA APHIS for US, MOCCAE for UAE, DEFRA OV network for UK, etc.) along with their scheduling channels.",
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
      name: "schedule_appointment",
      description:
        "Book a slot with an authority. Non-terminal; the appointment can be rescheduled until the endorsement is actually issued.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority_code: { type: "string" },
          appointment_iso: { type: "string", description: "ISO datetime of the slot." },
          channel: {
            type: "string",
            enum: ["in_person", "courier", "digital"],
          },
        },
        required: ["case_id", "authority_code", "appointment_iso", "channel"],
      },
    },
    {
      name: "submit_for_endorsement",
      description:
        "Terminal: submit the assembled document bundle to the authority. Writes a pending endorsement_requests row.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority_code: { type: "string" },
          document_ids: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            description: "documents.id values that travel with the submission.",
          },
          requirement_codes: {
            type: "array",
            items: { type: "string" },
            description: "Requirement codes from the assessment that this submission addresses.",
            minItems: 1,
          },
        },
        required: ["case_id", "authority_code", "document_ids", "requirement_codes"],
      },
    },
    {
      name: "record_endorsement_outcome",
      description:
        "Terminal: record an authority's decision once received. Writes to endorsement_outcomes; if rejected, the Orchestrator will re-dispatch Compliance.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          endorsement_request_id: { type: "string" },
          outcome: { type: "string", enum: ["approved", "rejected", "needs_amendment"] },
          endorsement_id: {
            type: "string",
            description: "The authority's reference number, when applicable.",
          },
          rejection_reason: {
            type: "string",
            description: "Required when outcome is `rejected` or `needs_amendment`.",
          },
        },
        required: ["case_id", "endorsement_request_id", "outcome"],
      },
    },
    {
      name: "escalate_to_specialist",
      description:
        "Terminal: hand off to the country specialist. Use when the authority's process is country-specific in a way the generic flow does not cover.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          country_code: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "country_code", "reason"],
      },
    },
    acknowledgeAndWaitTool(
      "Terminal: yield while waiting for the authority to respond. Use after `submit_for_endorsement` when the next event is inbound.",
    ),
  ],
  terminal_tools: [
    "submit_for_endorsement",
    "record_endorsement_outcome",
    "escalate_to_specialist",
    "acknowledge_and_wait",
  ],
  budget: { max_turns: 6, max_input_tokens: 50_000 },
});
