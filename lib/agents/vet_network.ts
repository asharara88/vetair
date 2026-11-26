// Vet Network — matches an owner to an approved vet and proposes
// microchip / vaccine / titer / endorsement appointment dates for the
// consensus-timeline loop in the orchestrator (AGENT.md §2.2).
//
// This agent reads the approved_vets table + the active case's
// corridor constraints, then emits a vet_proposal that the orchestrator
// cross-checks against airline_crate + endorsement proposals.

import { type AgentDefinition, validateAgent } from "./types";

const PROCEDURE_KINDS = [
  "microchip",
  "rabies_vaccine",
  "titer_test",
  "booster",
  "endorsement_exam",
  "fit_to_fly_exam",
] as const;

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved vet and proposes microchip / vaccine / titer / endorsement appointment dates for the consensus timeline.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "read_case_facts",
      description:
        "Read the pet row, owner origin/residence, and the case's earliest_legal_departure + target_date window.",
      input_schema: {
        type: "object" as const,
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "list_approved_vets",
      description:
        "Read the approved_vets table filtered by the owner's residence country and (optional) city.",
      input_schema: {
        type: "object" as const,
        properties: {
          country: { type: "string" },
          city: { type: "string" },
          accredited_for: {
            type: "string",
            enum: [...PROCEDURE_KINDS],
            description: "Only return vets accredited for this procedure.",
          },
        },
        required: ["country"],
      },
    },
    {
      name: "read_requirements_missing",
      description:
        "Read the latest compliance assessment's requirements_missing list so proposed appointments map to real blockers.",
      input_schema: {
        type: "object" as const,
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "emit_vet_proposal",
      description:
        "Terminal: propose a concrete vet + appointment plan for the case. Every appointment must cite the requirement_code it satisfies.",
      input_schema: {
        type: "object" as const,
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          appointments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                procedure: { type: "string", enum: [...PROCEDURE_KINDS] },
                earliest_date: { type: "string", description: "ISO date (YYYY-MM-DD)." },
                preferred_date: { type: "string", description: "ISO date (YYYY-MM-DD)." },
                satisfies_rules: {
                  type: "array",
                  items: { type: "string" },
                  description: "requirement_codes this appointment unblocks.",
                },
              },
              required: ["procedure", "preferred_date", "satisfies_rules"],
            },
            minItems: 1,
          },
          notes: { type: "string" },
        },
        required: ["case_id", "vet_id", "appointments"],
      },
    },
    {
      name: "no_vet_available",
      description:
        "Terminal: no approved vet covers the needed procedures in the owner's locality. Escalates to the orchestrator for a rerouting decision.",
      input_schema: {
        type: "object" as const,
        properties: {
          case_id: { type: "string" },
          missing_procedures: {
            type: "array",
            items: { type: "string", enum: [...PROCEDURE_KINDS] },
            minItems: 1,
          },
          reason: { type: "string" },
        },
        required: ["case_id", "missing_procedures", "reason"],
      },
    },
  ],
  terminal_tools: ["emit_vet_proposal", "no_vet_available"],
  budget: { max_turns: 5, max_input_tokens: 30_000 },
});

export const VET_PROCEDURE_KINDS = PROCEDURE_KINDS;
