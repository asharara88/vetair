// Vet Network — matches an owner to an approved vet in the origin country and
// books the procedure chain (microchip / vaccine / titer / endorsement). Emits
// a proposed appointment schedule that the orchestrator feeds into the timeline
// consensus round (see AGENT.md §2.2).

import { type AgentDefinition, validateAgent } from "./types";
import { ACKNOWLEDGE_AND_WAIT_TOOL } from "./shared-tools";

const PROCEDURE_KINDS = [
  "microchip",
  "rabies_vaccine",
  "rabies_titer",
  "booster",
  "health_check",
  "endorsement_visit",
] as const;

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved vet in the origin country and books the procedure chain. Proposes appointment dates for the timeline consensus round.",
  prompt_path: "lib/prompts/vet-network.md",
  tools: [
    {
      name: "read_case_facts",
      description: "Read case + pet + owner facts needed to match a vet (city, postal code, species, procedures required).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_assessment",
      description: "Read the latest compliance assessment to learn which procedures are missing.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "find_vets",
      description: "Query the approved_vets table by origin country + city + species + required procedure. Returns ranked matches.",
      input_schema: {
        type: "object",
        properties: {
          origin_country: { type: "string" },
          city: { type: "string" },
          species: { type: "string" },
          procedure: { type: "string", enum: [...PROCEDURE_KINDS] },
          max_results: { type: "integer", minimum: 1, maximum: 10 },
        },
        required: ["origin_country", "species", "procedure"],
      },
    },
    {
      name: "check_availability",
      description: "Check a vet's open slots in a window. Returns candidate datetime slots.",
      input_schema: {
        type: "object",
        properties: {
          vet_id: { type: "string" },
          window_start: { type: "string", description: "YYYY-MM-DD" },
          window_end: { type: "string", description: "YYYY-MM-DD" },
          procedure: { type: "string", enum: [...PROCEDURE_KINDS] },
        },
        required: ["vet_id", "window_start", "window_end", "procedure"],
      },
    },
    {
      name: "propose_schedule",
      description:
        "Terminal: emit a proposed appointment schedule for the timeline consensus. Each procedure is either a concrete slot or an owner-choice flag.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          appointments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                procedure: { type: "string", enum: [...PROCEDURE_KINDS] },
                proposed_at: { type: "string", description: "ISO 8601 datetime" },
                requirement_code: {
                  type: "string",
                  description: "Rule being satisfied (must appear in the assessment's cited_rules).",
                },
                requires_owner_confirmation: { type: "boolean" },
              },
              required: ["procedure", "proposed_at", "requirement_code"],
            },
            minItems: 1,
          },
          rationale: { type: "string" },
        },
        required: ["case_id", "vet_id", "appointments", "rationale"],
      },
    },
    {
      name: "no_match",
      description: "Terminal: no approved vet matches the case's constraints — escalate to human for manual outreach.",
      input_schema: {
        type: "object",
        properties: {
          reason: { type: "string" },
          searched: {
            type: "object",
            description: "The query that returned nothing (origin_country, city, species, procedure).",
          },
        },
        required: ["reason"],
      },
    },
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: ["propose_schedule", "no_match", "acknowledge_and_wait"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});

export const VET_PROCEDURE_KINDS = PROCEDURE_KINDS;
