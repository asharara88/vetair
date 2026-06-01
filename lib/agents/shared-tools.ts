// Shared tool builders + constants used by multiple agents.
// Centralizing avoids drift between agents that take the "same" tool with
// subtly different shapes (e.g. request_document with/without channel).

import type { AgentTool } from "./types";

// ---------- document kinds ----------
// The document categories an agent can request from the owner. Must match
// the enum used by the inbound webhook + Comms templates.

export const DOCUMENT_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
  "import_permit",
  "endorsement",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

// Specialist may also ask the owner to confirm the destination country when
// the synthesized prompt's country mismatches the case row.
export const SPECIALIST_DOCUMENT_KINDS = [
  ...DOCUMENT_KINDS,
  "confirm_destination",
] as const;

// ---------- shared tool factories ----------

/** Compact request_document tool — just `kind`. Used by intake/compliance/specialist. */
export function requestDocumentTool(
  kinds: readonly string[] = DOCUMENT_KINDS,
): AgentTool {
  return {
    name: "request_document",
    description: "Terminal: ask the owner via Comms for a missing document.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: [...kinds] },
      },
      required: ["kind"],
    },
  };
}

/** Channel-aware request_document — used by Comms, which actually sends the message. */
export function requestDocumentWithChannelTool(
  kinds: readonly string[] = DOCUMENT_KINDS,
): AgentTool {
  return {
    name: "request_document",
    description: "Terminal: send the owner a templated request for a specific document type.",
    input_schema: {
      type: "object",
      properties: {
        case_id: { type: "string" },
        channel: { type: "string", enum: ["whatsapp", "email"] },
        kind: { type: "string", enum: [...kinds] },
      },
      required: ["case_id", "channel", "kind"],
    },
  };
}

/** Single-question prompt that yields the loop until the owner replies. */
export const ASK_USER_FOR_INPUT_TOOL: AgentTool = {
  name: "ask_user_for_input",
  description: "Terminal: send a single-question prompt and yield until the owner replies.",
  input_schema: {
    type: "object",
    properties: {
      field: { type: "string" },
      question: { type: "string" },
    },
    required: ["field", "question"],
  },
};

/** Yield without dispatching anything new. Used by orchestrator + comms + audit. */
export const ACKNOWLEDGE_AND_WAIT_TOOL: AgentTool = {
  name: "acknowledge_and_wait",
  description: "Terminal: yield the loop without dispatch.",
  input_schema: {
    type: "object",
    properties: { reason: { type: "string" } },
    required: ["reason"],
  },
};

/** Consensus-loop tool: agent proposes feasible dates back to the orchestrator. */
export const PROPOSE_DATES_TOOL: AgentTool = {
  name: "propose_dates",
  description:
    "Terminal: propose feasible dates for this agent's leg of the timeline. Orchestrator runs a consensus round across all proposers.",
  input_schema: {
    type: "object",
    properties: {
      case_id: { type: "string" },
      dates: {
        type: "array",
        items: { type: "string", description: "ISO YYYY-MM-DD" },
        minItems: 1,
        maxItems: 5,
      },
      rationale: { type: "string" },
    },
    required: ["case_id", "dates", "rationale"],
  },
};

/** Read the most recent compliance assessment — shared by Comms + Endorsement. */
export const READ_ASSESSMENT_TOOL: AgentTool = {
  name: "read_assessment",
  description:
    "Read the most recent compliance assessment for a case (verdict, summary, cited_rules, requirements_missing).",
  input_schema: {
    type: "object",
    properties: { case_id: { type: "string" } },
    required: ["case_id"],
  },
};
