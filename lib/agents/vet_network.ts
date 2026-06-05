// Vet Network — books vet appointments along the compliance timeline.
// Microchip implant, rabies vaccine, rabies titer draw, pre-flight endorsement.
// First voice in the consensus timeline loop (with airline_crate + endorsement).

import { type AgentDefinition, validateAgent } from "./types";

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved vet in their city and proposes appointment dates for microchip / vaccine / titer / endorsement.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "read_pet_facts",
      description: "Read the pet row (species, breed, age, weight, microchip status, vaccine history).",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_assessment",
      description:
        "Read the most recent compliance assessment for a case (verdict, cited_rules, requirements_missing). Drives which procedures are still needed.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "list_approved_vets",
      description:
        "List approved vets in the owner's city that perform the requested procedure type. Approved = vet_registry.status='active' AND endorsement_certified for endorsement bookings.",
      input_schema: {
        type: "object",
        properties: {
          city: { type: "string" },
          procedure: {
            type: "string",
            enum: ["microchip", "rabies_vaccine", "rabies_titer", "endorsement", "health_certificate"],
          },
        },
        required: ["city", "procedure"],
      },
    },
    {
      name: "read_vet_availability",
      description: "Read available appointment slots for a vet within a date window.",
      input_schema: {
        type: "object",
        properties: {
          vet_id: { type: "string" },
          window_start: { type: "string", description: "ISO YYYY-MM-DD" },
          window_end: { type: "string", description: "ISO YYYY-MM-DD" },
        },
        required: ["vet_id", "window_start", "window_end"],
      },
    },
    {
      name: "propose_appointment",
      description:
        "Terminal: propose a single appointment for the consensus timeline. Orchestrator will weigh against airline_crate and endorsement proposals.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          procedure: {
            type: "string",
            enum: ["microchip", "rabies_vaccine", "rabies_titer", "endorsement", "health_certificate"],
          },
          proposed_date: { type: "string", description: "ISO YYYY-MM-DD" },
          window_basis: {
            type: "string",
            description: "Why this date is feasible — cite the requirement_code that drives the window.",
          },
          cited_rules: { type: "array", items: { type: "string" } },
        },
        required: ["case_id", "vet_id", "procedure", "proposed_date", "window_basis", "cited_rules"],
      },
    },
    {
      name: "book_appointment",
      description:
        "Terminal: book a proposed appointment after the orchestrator confirms the consensus date. Writes to vet_appointments with status='booked'.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          procedure: {
            type: "string",
            enum: ["microchip", "rabies_vaccine", "rabies_titer", "endorsement", "health_certificate"],
          },
          appointment_at: { type: "string", description: "ISO 8601 timestamp" },
        },
        required: ["case_id", "vet_id", "procedure", "appointment_at"],
      },
    },
    {
      name: "fail_booking",
      description:
        "Terminal: no approved vet has capacity in the legal window. Flags for exception_handler.",
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
  terminal_tools: ["propose_appointment", "book_appointment", "fail_booking"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
