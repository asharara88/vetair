// Tool fragments reused across multiple agents.
// Centralised so the schema for "ask the owner for X" stays consistent —
// intake, compliance, and comms all speak the same shape.

import type { AgentTool } from "./types";

// The full set of document kinds the system can request from an owner.
// Each agent narrows this list to the kinds it can legitimately request.
export const DOCUMENT_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
  "import_permit",
  "endorsement",
  "confirm_destination",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

// Build a `request_document` tool scoped to a subset of kinds.
// `description` is per-agent because the framing differs (terminal vs not).
export function requestDocumentTool(
  description: string,
  kinds: readonly DocumentKind[],
): AgentTool {
  return {
    name: "request_document",
    description,
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: [...kinds] },
      },
      required: ["kind"],
    },
  };
}

// Variant used by Comms — also carries case_id + channel because the tool
// actually drives the outbound message, not just an internal request.
export function requestDocumentOutboundTool(
  description: string,
  kinds: readonly DocumentKind[],
  channels: readonly string[] = ["whatsapp", "email"],
): AgentTool {
  return {
    name: "request_document",
    description,
    input_schema: {
      type: "object",
      properties: {
        case_id: { type: "string" },
        channel: { type: "string", enum: [...channels] },
        kind: { type: "string", enum: [...kinds] },
      },
      required: ["case_id", "channel", "kind"],
    },
  };
}

// "Yield the loop without dispatch / sending." Used by orchestrator + comms.
export const ACKNOWLEDGE_AND_WAIT_TOOL: AgentTool = {
  name: "acknowledge_and_wait",
  description: "Terminal: yield the loop without further action.",
  input_schema: {
    type: "object",
    properties: { reason: { type: "string" } },
    required: ["reason"],
  },
};

// Single-question prompt back to the owner. Used by intake + compliance.
export const ASK_USER_FOR_INPUT_TOOL: AgentTool = {
  name: "ask_user_for_input",
  description: "Terminal: ask the owner a single question and yield until they reply.",
  input_schema: {
    type: "object",
    properties: {
      field: { type: "string" },
      question: { type: "string" },
    },
    required: ["field", "question"],
  },
};

// Hand off to break-glass. Orchestrator + watchdog + exception_handler all use this.
export const ESCALATE_TO_HUMAN_TOOL: AgentTool = {
  name: "escalate_to_human",
  description:
    "Terminal: route the case to the human break-glass queue. Use when budget is exhausted, the auditor has dissented twice, or no automated remediation is safe.",
  input_schema: {
    type: "object",
    properties: {
      case_id: { type: "string" },
      reason: { type: "string" },
    },
    required: ["case_id", "reason"],
  },
};
