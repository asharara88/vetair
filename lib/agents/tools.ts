// Shared tool schemas reused across multiple agents.
// Centralised so the kind enums and shapes don't drift between intake,
// compliance, comms, the synthesized specialist, and the orchestrator.

import type { AgentTool } from "./types";

// Document kinds the owner can be asked to upload. Comms + intake share the
// short list; compliance + specialist extend it with downstream-only kinds.
export const OWNER_DOC_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
] as const;

export const COMPLIANCE_DOC_KINDS = [
  ...OWNER_DOC_KINDS,
  "import_permit",
  "endorsement",
] as const;

export const SPECIALIST_DOC_KINDS = [
  ...COMPLIANCE_DOC_KINDS,
  "confirm_destination",
] as const;

// `request_document` exists on intake, compliance, comms, and specialist —
// the variant differs only in (a) the enum of kinds and (b) whether it
// includes channel/case_id (Comms is the only one that sends the message
// itself; the others enqueue via Comms downstream).

export function requestDocumentTool(
  kinds: readonly string[],
  { includeCaseId = false, includeChannel = false }: { includeCaseId?: boolean; includeChannel?: boolean } = {},
): AgentTool {
  const properties: Record<string, unknown> = {
    kind: { type: "string", enum: [...kinds] },
  };
  const required: string[] = ["kind"];
  if (includeCaseId) {
    properties.case_id = { type: "string" };
    required.unshift("case_id");
  }
  if (includeChannel) {
    properties.channel = { type: "string", enum: ["whatsapp", "email"] };
    required.splice(1, 0, "channel");
  }
  return {
    name: "request_document",
    description: includeChannel
      ? "Terminal: send the owner a templated request for a specific document type."
      : "Terminal: ask the owner via Comms for a missing document.",
    input_schema: { type: "object", properties, required },
  };
}

// `ask_user_for_input` — used by intake (one question per turn) and
// compliance (when a missing fact blocks the assessment).
export const ASK_USER_FOR_INPUT_TOOL: AgentTool = {
  name: "ask_user_for_input",
  description: "Terminal: ask the owner via Comms for a missing fact (e.g. microchip date).",
  input_schema: {
    type: "object",
    properties: {
      field: { type: "string" },
      question: { type: "string" },
    },
    required: ["field", "question"],
  },
};

// `acknowledge_and_wait` — yield without dispatch. Used by orchestrator
// (waiting on an external signal) and comms (assessment already delivered).
export const ACKNOWLEDGE_AND_WAIT_TOOL: AgentTool = {
  name: "acknowledge_and_wait",
  description: "Terminal: yield the loop without dispatch (e.g. waiting on owner reply or no nudge needed).",
  input_schema: {
    type: "object",
    properties: { reason: { type: "string" } },
    required: ["reason"],
  },
};
