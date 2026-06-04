// Vet Network — matches the owner to an approved vet and books the
// microchip / rabies / titer / endorsement appointments the case needs.
// Reads the compliance assessment to know which procedures are outstanding
// and writes the booked appointments into the case's procedure ledger.

import { type AgentDefinition, validateAgent } from "./types";

const PROCEDURE_KINDS = [
  "microchip",
  "rabies_primary",
  "rabies_booster",
  "titer",
  "dhpp",
  "fvrcp",
  "health_certificate",
  "endorsement_vet_visit",
] as const;

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved vet and books microchip, vaccine, titer, and endorsement appointments.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "read_assessment",
      description:
        "Read the most recent compliance assessment for a case (verdict, summary, cited_rules, requirements_missing).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "list_approved_vets",
      description:
        "List approved vets in the owner's city/region. Returns clinic id, name, services offered, and earliest availability.",
      input_schema: {
        type: "object",
        properties: {
          city: { type: "string" },
          country: { type: "string" },
          services: {
            type: "array",
            items: { type: "string", enum: [...PROCEDURE_KINDS] },
            description: "Optional filter — only return clinics that offer these.",
          },
        },
        required: ["city", "country"],
      },
    },
    {
      name: "propose_appointments",
      description:
        "Terminal: emit a proposed appointment slate for the case. Orchestrator will fold this into the consensus timeline round.",
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
                procedure: { type: "string", enum: [...PROCEDURE_KINDS] },
                clinic_id: { type: "string" },
                proposed_at: {
                  type: "string",
                  description: "ISO 8601 timestamp of the appointment slot.",
                },
                requirement_code: {
                  type: "string",
                  description: "Country rule this appointment satisfies.",
                },
              },
              required: ["procedure", "clinic_id", "proposed_at", "requirement_code"],
            },
          },
        },
        required: ["case_id", "appointments"],
      },
    },
    {
      name: "request_owner_input",
      description:
        "Terminal: ask the owner via Comms for missing info (preferred clinic, accessibility, scheduling constraints).",
      input_schema: {
        type: "object",
        properties: {
          field: { type: "string" },
          question: { type: "string" },
        },
        required: ["field", "question"],
      },
    },
    {
      name: "escalate_no_coverage",
      description:
        "Terminal: no approved vet within reach can perform the required procedures. Routes to human ops.",
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
  terminal_tools: ["propose_appointments", "request_owner_input", "escalate_no_coverage"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
