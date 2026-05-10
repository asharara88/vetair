// Endorsement — owns the 7–10 day pre-flight window. Files MOCCAE / APHA /
// origin-government endorsement paperwork and tracks the courier leg back.

import { type AgentDefinition, validateAgent } from "./types";
import { caseIdInput } from "./tool-schemas";

const ENDORSEMENT_AUTHORITIES = ["MOCCAE", "APHA", "USDA_APHIS", "CFIA", "DAFF", "DEFRA"] as const;
const COURIER_PROVIDERS = ["dhl", "fedex", "ups", "in_person"] as const;

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement Team",
  description:
    "Owns the 7–10 day pre-flight endorsement window. Files MOCCAE / APHA / origin-government paperwork and tracks the courier leg.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_assessment",
      description:
        "Read the most recent compliance assessment to know which endorsement codes apply.",
      input_schema: caseIdInput(),
    },
    {
      name: "read_flight_proposal",
      description:
        "Read the locked flight proposal (depart_at, origin/destination IATA). The endorsement window is anchored to depart_at.",
      input_schema: caseIdInput(),
    },
    {
      name: "read_documents",
      description:
        "Read all case documents — the endorsement bundle is built from these (health cert, vax record, microchip cert, import permit).",
      input_schema: caseIdInput(),
    },
    {
      name: "compute_endorsement_window",
      description:
        "Given a depart_at and authority, return the inclusive window `[earliest, latest]` in which the endorsement signature is valid.",
      input_schema: {
        type: "object",
        properties: {
          depart_at: { type: "string" },
          authority: { type: "string", enum: [...ENDORSEMENT_AUTHORITIES] },
        },
        required: ["depart_at", "authority"],
      },
    },
    {
      name: "submit_filing",
      description:
        "Terminal: submit the endorsement bundle to the authority's portal (or queue it for the next office-hours window). Records `filing_id` for tracking.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: [...ENDORSEMENT_AUTHORITIES] },
          document_ids: { type: "array", items: { type: "string" } },
          submitted_at: { type: "string" },
          cited_rules: { type: "array", items: { type: "string" } },
        },
        required: ["case_id", "authority", "document_ids", "submitted_at", "cited_rules"],
      },
    },
    {
      name: "track_courier",
      description:
        "Terminal: enqueue a courier-tracking watcher. Returns when the signed bundle is back in our hands or escalates if the carrier reports a delivery exception.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          provider: { type: "string", enum: [...COURIER_PROVIDERS] },
          tracking_number: { type: "string" },
        },
        required: ["case_id", "provider", "tracking_number"],
      },
    },
    {
      name: "fail_endorsement",
      description:
        "Terminal: cannot file inside the legal window (e.g. depart_at < earliest endorsement signature, missing prerequisite document). Reason MUST cite the binding requirement_code.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          binding_requirement_code: { type: "string" },
        },
        required: ["case_id", "reason", "binding_requirement_code"],
      },
    },
  ],
  terminal_tools: ["submit_filing", "track_courier", "fail_endorsement"],
  budget: { max_turns: 5, max_input_tokens: 40_000 },
});
