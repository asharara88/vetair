// Shared tool factories. These are the small, identical-shape tools that
// recur across multiple agents (e.g. `request_document`, `acknowledge_and_wait`).
// Keep this list short — only patterns repeated in 3+ agents belong here.
//
// Anything specific to a single agent (e.g. `emit_assessment` for compliance)
// stays in that agent's file.

import type { AgentTool } from "./types";

export type DocumentKind =
  | "rabies"
  | "microchip"
  | "passport"
  | "vet_records"
  | "import_permit"
  | "endorsement"
  | "confirm_destination";

const CASE_ID_PROP = { case_id: { type: "string" as const } };

export function caseIdInputSchema(): AgentTool["input_schema"] {
  return { type: "object", properties: CASE_ID_PROP, required: ["case_id"] };
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

export function askUserForInputTool(): AgentTool {
  return {
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
}

interface RequestDocumentOpts {
  /** Allowed `kind` values for this agent. */
  kinds: readonly DocumentKind[];
  /** When true, the tool also takes `case_id` + `channel` (Comms shape).
   *  When false, it takes only `kind` (intake/compliance/specialist shape). */
  caseScoped?: boolean;
  description?: string;
}

export function requestDocumentTool({
  kinds,
  caseScoped = false,
  description,
}: RequestDocumentOpts): AgentTool {
  const kindEnum = { type: "string" as const, enum: [...kinds] };
  if (caseScoped) {
    return {
      name: "request_document",
      description:
        description ??
        "Terminal: send the owner a templated request for a specific document type.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          channel: { type: "string", enum: ["whatsapp", "email"] },
          kind: kindEnum,
        },
        required: ["case_id", "channel", "kind"],
      },
    };
  }
  return {
    name: "request_document",
    description: description ?? "Terminal: ask the owner via Comms for a missing document.",
    input_schema: {
      type: "object",
      properties: { kind: kindEnum },
      required: ["kind"],
    },
  };
}

export function readCaseTool(): AgentTool {
  return {
    name: "read_case",
    description: "Read the case row by id (state, corridor, target_date, budget counters).",
    input_schema: caseIdInputSchema(),
  };
}

export function readPetFactsTool(): AgentTool {
  return {
    name: "read_pet_facts",
    description: "Read the case's pet row (species, breed, weight, microchip, DOB).",
    input_schema: caseIdInputSchema(),
  };
}
