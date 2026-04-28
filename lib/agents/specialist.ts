// Specialist template — what the Synthesizer compiles from.
// Per synthesized_specialists row, the runtime registers a concrete agent
// with name `{country_code}_compliance_specialist` and parameters
// { country_code, country_name } substituted into the prompt.

import { type AgentDefinition, type AgentTool, validateAgent } from "./types";
import {
  COMPLIANCE_SHARED_READ_TOOLS,
  COMPLIANCE_ASSESSMENT_TOOL,
} from "./compliance";

export interface SpecialistParams {
  country_code: string; // ISO-3166 alpha-2 uppercase
  country_name: string;
}

const TEMPLATE_TOOLS: AgentTool[] = [
  ...COMPLIANCE_SHARED_READ_TOOLS,
  COMPLIANCE_ASSESSMENT_TOOL,
  {
    name: "request_document",
    description: "Terminal: ask the owner via Comms for a missing document.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["rabies", "microchip", "passport", "vet_records", "import_permit", "endorsement", "confirm_destination"] },
      },
      required: ["kind"],
    },
  },
];

export const SPECIALIST_TEMPLATE = {
  template_namespace: "compliance.specialist",
  template_name: "country_compliance_specialist",
  template_version: 1,
  prompt_path: "lib/prompts/specialist.md",
  required_params: ["country_code", "country_name"] as const,
  default_model: "claude-sonnet-4-6" as const,
  tools: TEMPLATE_TOOLS,
  terminal_tools: ["emit_assessment", "request_document"],
};

// Build a concrete AgentDefinition for a synthesized specialist.
// Called at dispatch time once the row in synthesized_specialists is loaded.
export function buildSpecialist(params: SpecialistParams, model = SPECIALIST_TEMPLATE.default_model): AgentDefinition {
  const cc = params.country_code.toUpperCase();
  return validateAgent({
    name: `${cc.toLowerCase()}_compliance_specialist`,
    type: "specialist",
    model,
    user_facing_label: `${cc} Specialist`,
    description: `${params.country_name} compliance specialist. Inherits the compliance loop with ${cc}-specific nuance.`,
    prompt_path: SPECIALIST_TEMPLATE.prompt_path,
    tools: TEMPLATE_TOOLS,
    terminal_tools: [...SPECIALIST_TEMPLATE.terminal_tools],
    budget: { max_turns: 8, max_input_tokens: 60_000 },
  });
}
