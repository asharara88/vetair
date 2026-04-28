// Synthesizer — compiles a parameterized template into a runtime specialist
// when a case opens for a country no specialist covers.

import { type AgentDefinition, validateAgent } from "./types";

export const SYNTHESIZER: AgentDefinition = validateAgent({
  name: "synthesizer",
  type: "synthesizer",
  model: "claude-sonnet-4-6",
  user_facing_label: "Specialist Factory",
  description:
    "Self-extension. Compiles a parameterized template into a runtime specialist when a case opens for an uncovered country.",
  prompt_path: "lib/prompts/synthesizer.md",
  tools: [
    {
      name: "list_templates",
      description: "Read the agent_templates table.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "read_template",
      description: "Read a template by id, including required_params and tool manifest.",
      input_schema: {
        type: "object",
        properties: { template_id: { type: "string" } },
        required: ["template_id"],
      },
    },
    {
      name: "find_specialist",
      description: "Look up an existing synthesized_specialists row by template_id + params hash.",
      input_schema: {
        type: "object",
        properties: {
          template_id: { type: "string" },
          params_hash: { type: "string" },
        },
        required: ["template_id", "params_hash"],
      },
    },
    {
      name: "register_specialist",
      description: "Terminal: insert a new synthesized_specialists row. Dedup is enforced at row level via params_hash.",
      input_schema: {
        type: "object",
        properties: {
          template_id: { type: "string" },
          params: { type: "object" },
          model: {
            type: "string",
            enum: ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5"],
          },
        },
        required: ["template_id", "params"],
      },
    },
    {
      name: "fail_synthesis",
      description: "Terminal: abort. Use when required params are missing or the loop is unproductive.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: ["register_specialist", "fail_synthesis"],
  budget: { max_turns: 6, max_input_tokens: 30_000 },
});
