// Shared tool schemas used by more than one agent.
// Keeping these in one file means a tool's contract (and its description) has
// exactly one place to change — agents that re-use it stay in lockstep.

import type { AgentTool } from "./types";

// ---------- document kinds ----------
// The intake set excludes downstream artifacts (import permits, endorsements)
// that the owner is not asked for during onboarding. The full set is what the
// later agents can request via Comms.

export const DOCUMENT_KINDS_INTAKE = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
] as const;

export const DOCUMENT_KINDS_FULL = [
  ...DOCUMENT_KINDS_INTAKE,
  "import_permit",
  "endorsement",
] as const;

// ---------- generic terminal tools ----------

export const ACKNOWLEDGE_AND_WAIT_TOOL: AgentTool = {
  name: "acknowledge_and_wait",
  description:
    "Terminal: yield the loop without dispatch. Use when no further action is needed this turn (e.g. waiting on an owner reply or an upstream agent).",
  input_schema: {
    type: "object",
    properties: { reason: { type: "string" } },
    required: ["reason"],
  },
};

export const ASK_USER_FOR_INPUT_TOOL: AgentTool = {
  name: "ask_user_for_input",
  description:
    "Terminal: send a single-question prompt to the owner and yield until they reply.",
  input_schema: {
    type: "object",
    properties: {
      field: { type: "string" },
      question: { type: "string" },
    },
    required: ["field", "question"],
  },
};

// `request_document` has two shapes across the codebase:
//   - "dispatch" form (intake/compliance/specialist): just `kind`, hands off
//     to Comms via the orchestrator. Intake calls it mid-loop (non-terminal);
//     compliance and specialists call it as their terminal action.
//   - "send" form (comms): `case_id`, `channel`, `kind` — Comms is the one
//     actually sending the templated message.
// Both are factories so each agent picks the kind enum that fits its stage.

export function requestDocumentDispatchTool(
  kinds: readonly string[],
  opts: { terminal?: boolean } = {},
): AgentTool {
  return {
    name: "request_document",
    description: opts.terminal
      ? "Terminal: ask the owner via Comms for a missing document."
      : "Ask the owner via Comms for a missing document.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: [...kinds] },
      },
      required: ["kind"],
    },
  };
}

export function requestDocumentSendTool(
  kinds: readonly string[],
  channels: readonly string[] = ["whatsapp", "email"],
): AgentTool {
  return {
    name: "request_document",
    description:
      "Terminal: send the owner a templated request for a specific document type.",
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

// ---------- compliance ----------
// Read tools shared between Compliance, Auditor, and synthesized Specialists.

export const COMPLIANCE_READ_TOOLS: AgentTool[] = [
  {
    name: "read_country_rules",
    description:
      "Read the country_rules table filtered by corridor + species.",
    input_schema: {
      type: "object",
      properties: {
        origin: { type: "string" },
        destination: { type: "string" },
        species: { type: "string" },
      },
      required: ["origin", "destination", "species"],
    },
  },
  {
    name: "read_documents",
    description: "Read all documents linked to a case (with extracted_fields).",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  },
  {
    name: "run_deterministic",
    description:
      "Run the deterministic TS evaluator for a single requirement_code. Authoritative on facts.",
    input_schema: {
      type: "object",
      properties: { rule_code: { type: "string" } },
      required: ["rule_code"],
    },
  },
];

export const COMPLIANCE_ASSESSMENT_TOOL: AgentTool = {
  name: "emit_assessment",
  description:
    "Terminal: write the compliance assessment for this case. Every requirements_missing entry must cite a requirement_code from {{country_rules}}.",
  input_schema: {
    type: "object",
    properties: {
      verdict: { type: "string", enum: ["approved", "blocked", "pending"] },
      summary: { type: "string" },
      cited_rules: { type: "array", items: { type: "string" } },
      requirements_missing: {
        type: "array",
        items: {
          type: "object",
          properties: {
            requirement_code: { type: "string" },
            what_needed: { type: "string" },
            blocking: { type: "boolean" },
          },
          required: ["requirement_code", "what_needed"],
        },
      },
    },
    required: ["verdict", "summary", "cited_rules", "requirements_missing"],
  },
};
