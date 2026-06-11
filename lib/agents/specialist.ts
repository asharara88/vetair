// Specialist template — what the Synthesizer compiles from.
// Per synthesized_specialists row, the runtime registers a concrete agent
// with name `{country_code}_compliance_specialist` and parameters
// { country_code, country_name } substituted into the prompt.

import { type AgentDefinition, type AgentTool, validateAgent } from "./types";
import {
  COMPLIANCE_SHARED_READ_TOOLS,
  COMPLIANCE_ASSESSMENT_TOOL,
  REQUEST_DOCUMENT_KINDS,
} from "./compliance";

export interface SpecialistParams {
  country_code: string; // ISO-3166 alpha-2 uppercase
  country_name: string;
}

// Specialists add `confirm_destination` to the document-kind enum — they use
// it when the case's destination_country drifts from the specialist's scope.
const SPECIALIST_REQUEST_DOCUMENT_TOOL: AgentTool = {
  name: "request_document",
  description: "Terminal: ask the owner via Comms for a missing document.",
  input_schema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: [...REQUEST_DOCUMENT_KINDS, "confirm_destination"] },
    },
    required: ["kind"],
  },
};

const TEMPLATE_TOOLS: AgentTool[] = [
  ...COMPLIANCE_SHARED_READ_TOOLS,
  COMPLIANCE_ASSESSMENT_TOOL,
  SPECIALIST_REQUEST_DOCUMENT_TOOL,
];

const TERMINAL_TOOLS = ["emit_assessment", "request_document"] as const;

export const SPECIALIST_TEMPLATE = {
  template_namespace: "compliance.specialist",
  template_name: "country_compliance_specialist",
  template_version: 2,
  prompt_path: "lib/prompts/specialist.md",
  required_params: ["country_code", "country_name"] as const,
  default_model: "claude-sonnet-4-6" as const,
  tools: TEMPLATE_TOOLS,
  terminal_tools: TERMINAL_TOOLS,
};

// Synthesized specialists follow the `{cc}_compliance_specialist` naming
// convention. Used by resolveAgent() to route by-name lookups.
const SPECIALIST_NAME_RE = /^[a-z]{2}_compliance_specialist$/;

export function isSpecialistAgentName(name: string): boolean {
  return SPECIALIST_NAME_RE.test(name);
}

// Build a concrete AgentDefinition for a synthesized specialist.
// Called at dispatch time once the row in synthesized_specialists is loaded.
export function buildSpecialist(
  params: SpecialistParams,
  model = SPECIALIST_TEMPLATE.default_model,
): AgentDefinition {
  const cc = params.country_code.toUpperCase();
  return validateAgent({
    name: `${cc.toLowerCase()}_compliance_specialist`,
    type: "specialist",
    model,
    user_facing_label: `${cc} Specialist`,
    description: `${params.country_name} compliance specialist. Inherits the compliance loop with ${cc}-specific nuance.`,
    prompt_path: SPECIALIST_TEMPLATE.prompt_path,
    tools: TEMPLATE_TOOLS,
    terminal_tools: [...TERMINAL_TOOLS],
    budget: { max_turns: 8, max_input_tokens: 60_000 },
  });
}
