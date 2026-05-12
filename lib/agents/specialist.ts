// Specialist template — what the Synthesizer compiles from.
// Per synthesized_specialists row, the runtime registers a concrete agent
// with name `{country_code}_compliance_specialist` and parameters
// { country_code, country_name } substituted into the prompt.

import { type AgentDefinition, type AgentTool, validateAgent } from "./types";
import {
  COMPLIANCE_SHARED_READ_TOOLS,
  COMPLIANCE_ASSESSMENT_TOOL,
} from "./compliance";
import { DOCUMENT_KINDS_SPECIALIST, requestDocumentTool } from "./shared";

export interface SpecialistParams {
  /** ISO-3166 alpha-2, uppercase (e.g. "JP"). */
  country_code: string;
  country_name: string;
}

const TEMPLATE_TOOLS: AgentTool[] = [
  ...COMPLIANCE_SHARED_READ_TOOLS,
  COMPLIANCE_ASSESSMENT_TOOL,
  requestDocumentTool(DOCUMENT_KINDS_SPECIALIST),
];

const TEMPLATE_TERMINAL_TOOLS = ["emit_assessment", "request_document"] as const;

export const SPECIALIST_TEMPLATE = {
  template_namespace: "compliance.specialist",
  template_name: "country_compliance_specialist",
  template_version: 2,
  prompt_path: "lib/prompts/specialist.md",
  required_params: ["country_code", "country_name"] as const,
  default_model: "claude-sonnet-4-6" as const,
  tools: TEMPLATE_TOOLS,
  terminal_tools: TEMPLATE_TERMINAL_TOOLS,
} as const;

/** Stable name pattern for a country-scoped specialist row. */
export const specialistName = (countryCode: string): string =>
  `${countryCode.toLowerCase()}_compliance_specialist`;

/**
 * Build a concrete AgentDefinition for a synthesized specialist.
 * Called at dispatch time once the row in synthesized_specialists is loaded.
 */
export function buildSpecialist(
  params: SpecialistParams,
  model: AgentDefinition["model"] = SPECIALIST_TEMPLATE.default_model,
): AgentDefinition {
  const cc = params.country_code.toUpperCase();
  return validateAgent({
    name: specialistName(cc),
    type: "specialist",
    model,
    user_facing_label: `${cc} Specialist`,
    description: `${params.country_name} compliance specialist. Inherits the compliance loop with ${cc}-specific nuance.`,
    prompt_path: SPECIALIST_TEMPLATE.prompt_path,
    tools: TEMPLATE_TOOLS,
    terminal_tools: [...TEMPLATE_TERMINAL_TOOLS],
    budget: { max_turns: 8, max_input_tokens: 60_000 },
  });
}
