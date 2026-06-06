// Vet Network — matches the owner to an approved corridor vet and books
// the procedures (microchip, rabies, titer, endorsement appointment).
// Reads-only against the country rules; writes appointments into the
// vet_appointments table via book_appointment.

import { type AgentDefinition, validateAgent } from "./types";

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved corridor vet. Schedules microchip / vaccine / titer / endorsement appointments inside the legal windows.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "read_case_locations",
      description: "Read the case's residence city + destination so vet matching respects geography.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "list_approved_vets",
      description:
        "List vets approved for a (residence_country, destination_country, species) corridor. Returns clinic name, OV (Official Veterinarian) status, distance, and next available slot.",
      input_schema: {
        type: "object",
        properties: {
          residence_country: { type: "string" },
          destination_country: { type: "string" },
          species: { type: "string" },
          residence_city: { type: "string" },
        },
        required: ["residence_country", "destination_country", "species"],
      },
    },
    {
      name: "read_legal_windows",
      description:
        "Read the deterministic windows for this case (earliest_legal_vaccine, earliest_endorsement, latest_endorsement). Authoritative.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "book_appointment",
      description:
        "Propose an appointment with a specific vet for a procedure. Date must fall inside the legal window for that procedure or the call is rejected by the API.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          procedure: {
            type: "string",
            enum: ["microchip", "rabies_vaccine", "rabies_titer", "health_certificate", "endorsement_appointment"],
          },
          proposed_date: { type: "string", description: "ISO YYYY-MM-DD" },
        },
        required: ["case_id", "vet_id", "procedure", "proposed_date"],
      },
    },
    {
      name: "emit_plan",
      description:
        "Terminal: commit the booked appointments and hand back to the orchestrator. Every appointment must reference a vet_id from list_approved_vets — inventing vets is a hard error.",
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
                procedure: { type: "string" },
                date: { type: "string" },
                requirement_codes: {
                  type: "array",
                  items: { type: "string" },
                  description: "Which requirement_codes this appointment is intended to satisfy.",
                },
              },
              required: ["procedure", "date", "requirement_codes"],
            },
            minItems: 1,
          },
        },
        required: ["case_id", "vet_id", "appointments"],
      },
    },
    {
      name: "ask_user_for_input",
      description:
        "Terminal: ask the owner via Comms for a missing fact (e.g. preferred clinic, residence city). Use only when a fact blocks vet selection.",
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
      name: "fail_plan",
      description:
        "Terminal: abort. Use when no approved vet exists for the corridor or every candidate is unavailable in the legal window.",
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
  terminal_tools: ["emit_plan", "ask_user_for_input", "fail_plan"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
