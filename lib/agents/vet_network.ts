// Vet Network — matches the owner to an approved vet and books the procedure
// implied by the compliance plan (microchip, rabies, titer, pre-flight exam,
// endorsement signature). Reads the vet_providers table; never invents clinics.

import { type AgentDefinition, validateAgent } from "./types";

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved vet and books the procedure implied by the compliance plan. Reads vet_providers; never invents clinics.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "read_vet_providers",
      description:
        "Read the vet_providers table filtered by the owner's residence country and the procedure kind. Rows include clinic name, address, next_available_slot, accredited_authorities[], accepts_pet_species[].",
      input_schema: {
        type: "object",
        properties: {
          country: { type: "string", description: "ISO-3166 alpha-2 of the owner's current residence." },
          city: { type: "string" },
          procedure: {
            type: "string",
            enum: ["microchip", "rabies_vaccine", "rabies_titer", "pre_flight_exam", "endorsement_signature"],
          },
          species: { type: "string", enum: ["dog", "cat", "ferret"] },
        },
        required: ["country", "procedure", "species"],
      },
    },
    {
      name: "read_case_timing_constraints",
      description:
        "Read the earliest_legal_date and any upstream dependencies for the procedure (e.g. a rabies titer must be ≥30 days after the booster). Returns `{ earliest_legal_date, latest_useful_date, depends_on[] }`.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          procedure: { type: "string" },
        },
        required: ["case_id", "procedure"],
      },
    },
    {
      name: "propose_appointment",
      description:
        "Terminal: emit a concrete appointment proposal for the orchestrator's consensus round. The provider_id must come from read_vet_providers; the slot must satisfy the timing constraints.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          provider_id: { type: "string" },
          procedure: { type: "string" },
          proposed_slot: {
            type: "string",
            description: "ISO-8601 datetime in the provider's local timezone.",
          },
          rationale: {
            type: "string",
            description: "Why this provider + slot — cite the timing constraint that pinned it.",
          },
        },
        required: ["case_id", "provider_id", "procedure", "proposed_slot", "rationale"],
      },
    },
    {
      name: "request_manual_booking",
      description:
        "Terminal: no accredited provider has an acceptable slot. Escalates to the operator with the shortlist of providers considered.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          procedure: { type: "string" },
          shortlist: {
            type: "array",
            items: { type: "string" },
            description: "provider_ids considered but not bookable within the window.",
          },
          reason: { type: "string" },
        },
        required: ["case_id", "procedure", "shortlist", "reason"],
      },
    },
    {
      name: "no_provider_available",
      description:
        "Terminal: the vet_providers table has zero accredited matches for this corridor + procedure. Hands back to the orchestrator so it can request network expansion.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          procedure: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "procedure", "reason"],
      },
    },
  ],
  terminal_tools: ["propose_appointment", "request_manual_booking", "no_provider_available"],
  budget: { max_turns: 5, max_input_tokens: 40_000 },
});
