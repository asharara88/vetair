// Vet Network — matches the owner to an approved vet and proposes a date plan
// for the appointments compliance demands (microchip, rabies, titer, endorsement).
// Does not book directly — it proposes; the orchestrator confirms with the owner.

import { type AgentDefinition, validateAgent } from "./types";

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches owners to approved vets and proposes appointment dates for the procedures compliance requires.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "search_approved_vets",
      description:
        "Search the approved_vets table for clinics in the owner's residence country qualified to issue the requested certificate type.",
      input_schema: {
        type: "object",
        properties: {
          country: { type: "string" },
          city: { type: "string" },
          certifies: {
            type: "string",
            enum: ["microchip", "rabies", "titer", "health_certificate", "endorsement"],
          },
        },
        required: ["country", "certifies"],
      },
    },
    {
      name: "read_assessment",
      description: "Read the latest compliance assessment so you know which procedures are actually required.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_pet_facts",
      description: "Read the pet row to know weight, age, and current microchip / vaccine state.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "propose_appointments",
      description:
        "Terminal: propose an ordered slate of appointments. Each entry must cite the requirement_code it satisfies. Dates are ISO YYYY-MM-DD; use null when only a window can be guaranteed.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          appointments: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                vet_id: { type: "string" },
                procedure: {
                  type: "string",
                  enum: ["microchip", "rabies", "titer", "health_certificate", "endorsement"],
                },
                proposed_date: { type: "string" },
                window_start: { type: "string" },
                window_end: { type: "string" },
                cited_rules: { type: "array", items: { type: "string" } },
              },
              required: ["vet_id", "procedure", "cited_rules"],
            },
          },
        },
        required: ["case_id", "appointments"],
      },
    },
    {
      name: "fail_no_match",
      description:
        "Terminal: abort. Use when no approved vet covers the required procedure within the owner's reachable area.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
  ],
  terminal_tools: ["propose_appointments", "fail_no_match"],
  budget: { max_turns: 5, max_input_tokens: 40_000 },
});
