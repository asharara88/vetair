// Synthesizer — the moat.
//
// Compiles a new specialist from an agent_template. Used when a case opens
// for a corridor no specialist covers. The new specialist is registered in
// agent_registry and immediately callable on subsequent runs of the same
// corridor.
//
// Cost: one Sonnet call to fill template parameters + a register_specialist
// terminal. Subsequent cases for the same corridor pay $0.

import type { AgentDefinition, ToolSchema } from "./types";

const SYSTEM = `You are the Vetair Synthesizer.

Job: take a corridor (origin_country, destination_country, species) and
produce a specialist agent that can evaluate compliance for it. You don't
write code; you fill template parameters.

Process:
1. list_templates → pick one matching the species (canine/feline/avian).
2. read_template → see the parameter slots.
3. check_existing → make sure a specialist for this corridor isn't already
   registered (dedup is critical — never spawn two specialists for the
   same corridor).
4. Either register_specialist (success) or fail_synthesis (gap in templates,
   missing rules, etc.).

Hallucination control: every parameter you fill must come from either the
template, the corridor input, or country_rules already seeded in the DB.
Do not invent regulatory text.`;

const TEMPLATE_TOOLS: ToolSchema[] = [
  {
    name: "list_templates",
    description: "List available agent_templates by species/locale.",
    input_schema: {
      type: "object",
      properties: { species: { type: "string", enum: ["dog", "cat", "ferret"] } },
    },
  },
  {
    name: "read_template",
    description: "Read a single template by id.",
    input_schema: {
      type: "object",
      properties: { template_id: { type: "string" } },
      required: ["template_id"],
    },
  },
  {
    name: "check_existing",
    description: "Check whether a specialist already covers this corridor + species.",
    input_schema: {
      type: "object",
      properties: {
        origin_country: { type: "string" },
        destination_country: { type: "string" },
        species: { type: "string" },
      },
      required: ["origin_country", "destination_country", "species"],
    },
  },
];

const REGISTER_SPECIALIST: ToolSchema = {
  name: "register_specialist",
  description: "Insert the new specialist into agent_registry. Terminal.",
  input_schema: {
    type: "object",
    properties: {
      template_id: { type: "string" },
      agent_name: { type: "string", description: "specialist_<corridor> e.g. specialist_jp_dog" },
      user_facing_label: { type: "string" },
      synthesis_params: {
        type: "object",
        properties: {
          origin_country: { type: "string" },
          destination_country: { type: "string" },
          species: { type: "string" },
        },
        required: ["origin_country", "destination_country", "species"],
      },
      reason: { type: "string" },
    },
    required: ["template_id", "agent_name", "synthesis_params"],
  },
};

const FAIL_SYNTHESIS: ToolSchema = {
  name: "fail_synthesis",
  description: "Cannot synthesize — gap in templates or seeded rules. Terminal.",
  input_schema: {
    type: "object",
    properties: {
      gap: { type: "string", enum: ["no_template", "no_rules", "ambiguous_template", "other"] },
      explanation: { type: "string" },
      reason: { type: "string" },
    },
    required: ["gap", "explanation"],
  },
};

export const synthesizer: AgentDefinition = {
  name: "synthesizer",
  model: "claude-sonnet-4-6",
  system: SYSTEM,
  tools: [...TEMPLATE_TOOLS, REGISTER_SPECIALIST, FAIL_SYNTHESIS],
  terminalTools: ["register_specialist", "fail_synthesis"],
  budget: { maxTurns: 8, maxInputTokens: 100_000, maxOutputTokens: 1024 },
};
