// Cross-agent tool primitives.
// Several agents expose identical or near-identical tools (yielding the loop,
// asking the owner a question, requesting a document). Defining them once here
// keeps the wire-level schema consistent and makes agent files declarative.

import type { AgentTool } from "./types";

// ---------- request_document ----------

// Canonical set of document kinds an agent may request from the owner.
// Subsets are exposed per agent — Intake never asks for an import permit,
// the synthesized specialist additionally asks for destination confirmation.
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

export const INTAKE_DOCUMENT_KINDS: readonly DocumentKind[] = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
];

export const COMPLIANCE_DOCUMENT_KINDS: readonly DocumentKind[] = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
  "import_permit",
  "endorsement",
];

export const SPECIALIST_DOCUMENT_KINDS: readonly DocumentKind[] = [
  ...COMPLIANCE_DOCUMENT_KINDS,
  "confirm_destination",
];

// Build a request_document tool. Compliance/Intake/Specialist all ask Comms
// to dispatch the templated message and only pass `kind`. Comms itself dispatches
// directly and additionally takes `case_id` + `channel`.
export function requestDocumentTool(opts: {
  kinds: readonly DocumentKind[];
  description: string;
  withDispatch?: boolean; // true for Comms (sends to owner directly)
}): AgentTool {
  const properties: Record<string, unknown> = {
    kind: { type: "string", enum: [...opts.kinds] },
  };
  const required: string[] = ["kind"];
  if (opts.withDispatch) {
    properties.case_id = { type: "string" };
    properties.channel = { type: "string", enum: ["whatsapp", "email"] };
    required.unshift("case_id", "channel");
  }
  return {
    name: "request_document",
    description: opts.description,
    input_schema: { type: "object", properties, required },
  };
}

// ---------- ask_user_for_input ----------
// Intake + Compliance both yield to the owner via the same shape. Shared verbatim.

export const ASK_USER_FOR_INPUT_TOOL: AgentTool = {
  name: "ask_user_for_input",
  description:
    "Terminal: send a single-question prompt and yield until the owner replies.",
  input_schema: {
    type: "object",
    properties: {
      field: { type: "string" },
      question: { type: "string" },
    },
    required: ["field", "question"],
  },
};

// ---------- acknowledge_and_wait ----------
// Orchestrator + Comms both yield the loop without dispatching. Same schema,
// agent-specific framing belongs in the description override.

export function acknowledgeAndWaitTool(description: string): AgentTool {
  return {
    name: "acknowledge_and_wait",
    description,
    input_schema: {
      type: "object",
      properties: { reason: { type: "string" } },
      required: ["reason"],
    },
  };
}
