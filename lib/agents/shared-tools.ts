// Shared tool fragments + enums reused across multiple agents.
// Define document/channel taxonomies in ONE place so a new doc type doesn't
// require sweeping per-agent enum edits.

import type { AgentTool } from "./types";

// ---------- document taxonomies ----------

export const DOCUMENT_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
  "import_permit",
  "endorsement",
  "crate_specs",
  "confirm_destination",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

// Per-agent subsets — the model gets a tighter enum, so it can't ask for kinds
// the agent has no plausible workflow for.
export const INTAKE_DOCUMENT_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
] as const satisfies readonly DocumentKind[];

export const COMPLIANCE_DOCUMENT_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
  "import_permit",
  "endorsement",
] as const satisfies readonly DocumentKind[];

export const SPECIALIST_DOCUMENT_KINDS = [
  ...COMPLIANCE_DOCUMENT_KINDS,
  "confirm_destination",
] as const satisfies readonly DocumentKind[];

export const COMMS_CHANNELS = ["whatsapp", "email", "sms"] as const;
export type CommsChannel = (typeof COMMS_CHANNELS)[number];

// ---------- tool factories ----------
// Each factory returns a fresh object so callers can't accidentally mutate a
// shared schema (Anthropic tool definitions are passed around by reference).

export interface RequestDocumentOpts {
  /** Subset of DOCUMENT_KINDS the model may ask for. */
  kinds: readonly DocumentKind[];
  /** When true, include `case_id` and `channel` (used by Comms-style senders). */
  withCaseAndChannel?: boolean;
  /** Override the description; otherwise a sane default is emitted. */
  description?: string;
}

export function requestDocumentTool(opts: RequestDocumentOpts): AgentTool {
  const properties: Record<string, unknown> = {
    kind: { type: "string", enum: [...opts.kinds] },
  };
  const required: string[] = ["kind"];
  if (opts.withCaseAndChannel) {
    properties.case_id = { type: "string" };
    properties.channel = { type: "string", enum: ["whatsapp", "email"] };
    required.unshift("case_id", "channel");
  }
  return {
    name: "request_document",
    description:
      opts.description ??
      "Terminal: ask the owner via Comms for a missing document of the given kind.",
    input_schema: { type: "object", properties, required },
  };
}

export function askUserForInputTool(description?: string): AgentTool {
  return {
    name: "ask_user_for_input",
    description:
      description ??
      "Terminal: ask the owner a single targeted question and yield until they reply.",
    input_schema: {
      type: "object",
      properties: {
        field: { type: "string" },
        question: { type: "string" },
      },
      required: ["field", "question"],
    },
  };
}

export function acknowledgeAndWaitTool(description?: string): AgentTool {
  return {
    name: "acknowledge_and_wait",
    description:
      description ??
      "Terminal: yield the loop without dispatch (e.g. waiting on owner reply or downstream completion).",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string" } },
      required: ["reason"],
    },
  };
}

export function readCaseTool(description?: string): AgentTool {
  return {
    name: "read_case",
    description: description ?? "Read a case row by id.",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  };
}

export function readAssessmentTool(description?: string): AgentTool {
  return {
    name: "read_assessment",
    description:
      description ??
      "Read the most recent compliance assessment for a case (verdict, summary, cited_rules, requirements_missing).",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  };
}
