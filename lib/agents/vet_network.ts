// Vet Network — matches owner to an approved vet and books the procedures that
// satisfy compliance: microchip, rabies/booster, titer (for rabies-free
// destinations), and the OV endorsement appointment.

import { type AgentDefinition, validateAgent } from "./types";

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches owner to an approved vet within the corridor and proposes appointment slots for microchip, vaccine, titer, and endorsement procedures.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "list_approved_vets",
      description:
        "Read the approved_vets table filtered by origin country and city. Returns vet handles, services offered, distance bucket, and current availability window.",
      input_schema: {
        type: "object",
        properties: {
          origin_country: { type: "string" },
          city: { type: "string" },
          service: {
            type: "string",
            enum: ["microchip", "rabies", "titer", "endorsement", "health_certificate"],
          },
        },
        required: ["origin_country", "service"],
      },
    },
    {
      name: "read_pet_facts",
      description: "Read the pet row to know what procedures are already done (microchip, vaccine dates).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_assessment",
      description: "Read the latest compliance assessment to learn which requirement_codes are still pending.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "propose_appointment",
      description:
        "Non-terminal: propose a single appointment slot to the orchestrator's consensus round. Use one tool call per procedure — never bundle.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          procedure: {
            type: "string",
            enum: ["microchip", "rabies", "titer", "endorsement", "health_certificate"],
          },
          slot_iso: { type: "string", description: "ISO 8601 datetime of the proposed slot." },
          satisfies_codes: {
            type: "array",
            items: { type: "string" },
            description: "Requirement codes this procedure satisfies. Must trace back to the assessment.",
          },
        },
        required: ["case_id", "vet_id", "procedure", "slot_iso", "satisfies_codes"],
      },
    },
    {
      name: "emit_plan",
      description:
        "Terminal: commit a full procedure plan for the case. The orchestrator forwards it into the consensus timeline loop.",
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
                  enum: ["microchip", "rabies", "titer", "endorsement", "health_certificate"],
                },
                slot_iso: { type: "string" },
                satisfies_codes: { type: "array", items: { type: "string" } },
              },
              required: ["vet_id", "procedure", "slot_iso", "satisfies_codes"],
            },
          },
          rationale: { type: "string" },
        },
        required: ["case_id", "appointments", "rationale"],
      },
    },
    {
      name: "fail_planning",
      description: "Terminal: no feasible appointment plan exists (e.g. no approved vet within window). Escalates to orchestrator.",
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
  terminal_tools: ["emit_plan", "fail_planning"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
