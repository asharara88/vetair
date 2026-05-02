// Tool schemas shared across multiple agents. Hoisted here so a change to
// (e.g.) the `acknowledge_and_wait` shape doesn't require editing five files.

import type { AgentTool } from "./types";

/** Yield the loop without taking a customer-visible action. */
export const ACKNOWLEDGE_AND_WAIT: AgentTool = {
  name: "acknowledge_and_wait",
  description:
    "Terminal: yield the loop without dispatch. Use when the next event must come from outside (owner reply, courier scan, partner confirmation).",
  input_schema: {
    type: "object",
    properties: { reason: { type: "string" } },
    required: ["reason"],
  },
};

/** Ask the owner for a single typed fact via Comms. Used by intake + compliance. */
export const ASK_USER_FOR_INPUT: AgentTool = {
  name: "ask_user_for_input",
  description:
    "Terminal: send a single-question prompt and yield until the owner replies. One question per call.",
  input_schema: {
    type: "object",
    properties: {
      field: { type: "string" },
      question: { type: "string" },
    },
    required: ["field", "question"],
  },
};

/**
 * Document kinds the owner can be asked to upload. Comms/Compliance/Specialist
 * share the wide set; Intake uses the narrow `INTAKE_DOC_KINDS` subset.
 */
export const DOC_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
  "import_permit",
  "endorsement",
] as const;

export const INTAKE_DOC_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
] as const;

export type DocKind = (typeof DOC_KINDS)[number];
