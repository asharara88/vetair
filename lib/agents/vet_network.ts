// Vet Network — matches the owner to an approved vet in the residence country
// and books the appointments compliance flagged: microchip, vaccine, titer,
// government endorsement. Ordering and time-constraint windows are enforced in
// the prompt; this file just typecasts the tool surface.

import { type AgentDefinition, validateAgent } from "./types";

const VET_SERVICE_ENUM = ["microchip", "rabies_vaccine", "rabies_titer", "endorsement"] as const;

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved vet in the residence country. Books microchip / vaccine / titer / endorsement appointments in the order the rules require.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "read_vet_directory",
      description: "Look up approved vets in a country, optionally filtered by the services they offer.",
      input_schema: {
        type: "object",
        properties: {
          country: { type: "string", description: "ISO-3166 alpha-2 country code." },
          service: { type: "array", items: { type: "string", enum: [...VET_SERVICE_ENUM] } },
        },
        required: ["country"],
      },
    },
    {
      name: "read_assessment",
      description: "Read the active compliance assessment for the case so the booking targets cited requirements only.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "propose_appointment",
      description: "Reserve an internal proposal — does NOT confirm. Use this to surface a date for owner confirmation.",
      input_schema: {
        type: "object",
        properties: {
          vet_id: { type: "string" },
          service: { type: "string", enum: [...VET_SERVICE_ENUM] },
          earliest_date: { type: "string", description: "ISO YYYY-MM-DD." },
          latest_date: { type: "string", description: "ISO YYYY-MM-DD." },
        },
        required: ["vet_id", "service", "earliest_date", "latest_date"],
      },
    },
    {
      name: "request_owner_confirmation",
      description: "Terminal: ask the owner via Comms to confirm a proposed appointment. Yields until the owner replies.",
      input_schema: {
        type: "object",
        properties: {
          vet_id: { type: "string" },
          service: { type: "string", enum: [...VET_SERVICE_ENUM] },
          proposed_date: { type: "string" },
        },
        required: ["vet_id", "service", "proposed_date"],
      },
    },
    {
      name: "book_appointment",
      description: "Terminal: hold the slot in the vet's calendar and write the appointment row.",
      input_schema: {
        type: "object",
        properties: {
          vet_id: { type: "string" },
          service: { type: "string", enum: [...VET_SERVICE_ENUM] },
          date: { type: "string", description: "ISO YYYY-MM-DD." },
          time_window: { type: "string", description: "HH:MM-HH:MM 24-hour." },
        },
        required: ["vet_id", "service", "date", "time_window"],
      },
    },
    {
      name: "escalate_no_capacity",
      description: "Terminal: no vet has capacity inside the legal window. Routes to the human queue with a concrete reason.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: ["request_owner_confirmation", "book_appointment", "escalate_no_capacity"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
