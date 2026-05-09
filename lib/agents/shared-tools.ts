// Shared tool definitions used by multiple agents.
// Centralized here so the document-kind enum, prompt-routed schemas, and
// terminal-yield primitives stay consistent across the registry.

import type { AgentTool } from "./types";

// Canonical document kinds the system understands. Adding a new kind here
// propagates to intake, compliance, comms, and synthesized specialists.
export const DOCUMENT_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
  "import_permit",
  "endorsement",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

// Specialists may also ask the owner to confirm the destination country
// before they accept a case (since their scope is country-bound).
export const SPECIALIST_DOCUMENT_KINDS = [...DOCUMENT_KINDS, "confirm_destination"] as const;

// Build a request_document tool with the caller's choice of kind enum and
// whether case_id is required (Comms knows the case_id, intake/compliance
// run inside an active case context and don't need it on the wire).
export function requestDocumentTool(opts: {
  kinds: readonly string[];
  withCaseId?: boolean;
  withChannel?: boolean;
  description?: string;
}): AgentTool {
  const properties: Record<string, unknown> = {
    kind: { type: "string", enum: [...opts.kinds] },
  };
  const required: string[] = ["kind"];
  if (opts.withCaseId) {
    properties.case_id = { type: "string" };
    required.unshift("case_id");
  }
  if (opts.withChannel) {
    properties.channel = { type: "string", enum: ["whatsapp", "email"] };
    required.push("channel");
  }
  return {
    name: "request_document",
    description:
      opts.description ??
      "Terminal: ask the owner via Comms for a missing document. The Comms agent will format and send the actual message.",
    input_schema: { type: "object", properties, required },
  };
}

// Single-question yield. Compliance + Intake both use this — a `field`
// label that names the missing fact, and a question the owner will see.
export const ASK_USER_FOR_INPUT_TOOL: AgentTool = {
  name: "ask_user_for_input",
  description:
    "Terminal: send a single-question prompt and yield until the owner replies. The `field` is a stable handle (e.g. `microchip_implant_date`); the `question` is the owner-facing text.",
  input_schema: {
    type: "object",
    properties: {
      field: { type: "string" },
      question: { type: "string" },
    },
    required: ["field", "question"],
  },
};

// Yield without dispatch — used by the orchestrator when waiting on an
// owner reply, and by Comms when the assessment is final and no nudge
// is needed.
export const ACKNOWLEDGE_AND_WAIT_TOOL: AgentTool = {
  name: "acknowledge_and_wait",
  description: "Terminal: yield the loop without dispatch (e.g. waiting on owner reply, or no further outbound needed).",
  input_schema: {
    type: "object",
    properties: { reason: { type: "string" } },
    required: ["reason"],
  },
};
