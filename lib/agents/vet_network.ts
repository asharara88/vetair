// Vet Network — matches an owner to an approved vet and proposes the slots
// the consensus timeline loop will vote on. Booking is two-phase: propose first
// (the proposal feeds the consensus round), then confirm once consensus locks.

import { type AgentDefinition, validateAgent } from "./types";

const PROCEDURE_KINDS = [
  "microchip_implant",
  "rabies_primary",
  "rabies_booster",
  "rabies_titer",
  "endorsement_exam",
  "health_certificate",
  "parasite_treatment",
] as const;

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches owners to approved vets and proposes appointment slots for microchip, vaccine, titer, and endorsement bookings.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "list_approved_vets",
      description:
        "Read the partner_vets table filtered by country + city + procedure type. Returns only clinics flagged `approved_for_export=true` for the species.",
      input_schema: {
        type: "object",
        properties: {
          country: { type: "string" },
          city: { type: "string" },
          procedure_type: { type: "string", enum: [...PROCEDURE_KINDS] },
          species: { type: "string" },
        },
        required: ["country", "procedure_type", "species"],
      },
    },
    {
      name: "read_pet_facts",
      description: "Read the case's pet row so you can match procedure prerequisites (species, age, weight).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_requirements_missing",
      description:
        "Read the latest compliance assessment's `requirements_missing[]` to confirm which procedures still need a booking.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "propose_appointment",
      description:
        "Terminal: emit a proposed slot for the consensus round. Does NOT book; the slot goes to the orchestrator's consensus vote with the airline + endorsement proposals.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          procedure_type: { type: "string", enum: [...PROCEDURE_KINDS] },
          proposed_date: { type: "string", description: "ISO YYYY-MM-DD" },
          alternative_dates: {
            type: "array",
            items: { type: "string" },
            description: "Up to 2 fallback ISO dates if the consensus round rejects the primary.",
            maxItems: 2,
          },
        },
        required: ["case_id", "vet_id", "procedure_type", "proposed_date"],
      },
    },
    {
      name: "confirm_booking",
      description:
        "Terminal: actually book the proposed slot. Only call after the orchestrator signals consensus has locked the date.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          proposal_id: { type: "string" },
        },
        required: ["case_id", "proposal_id"],
      },
    },
    {
      name: "escalate_no_vet",
      description:
        "Terminal: no approved vet within the corridor + procedure window. Routes to human concierge desk.",
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
  terminal_tools: ["propose_appointment", "confirm_booking", "escalate_no_vet"],
  budget: { max_turns: 5, max_input_tokens: 30_000 },
});

export const VET_NETWORK_PROCEDURE_KINDS = PROCEDURE_KINDS;
