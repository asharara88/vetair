// Vet Network — matches the owner to an approved vet and books the
// microchip / vaccine / titer / endorsement appointments the corridor needs.
// Reads (not writes) the country rule set; it doesn't reason about compliance,
// it operationalizes what the compliance assessment said is missing.

import { type AgentDefinition, type AgentTool, validateAgent } from "./types";

const TOOLS: AgentTool[] = [
  {
    name: "read_assessment",
    description: "Read the most recent compliance assessment to learn which procedures are required.",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  },
  {
    name: "read_owner_location",
    description: "Read the owner's residence city + country so we can scope the vet search.",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  },
  {
    name: "search_approved_vets",
    description:
      "List approved vets within commuting distance of the owner. Filter by procedures offered (e.g. titer draw, USDA-endorsed health certificates).",
    input_schema: {
      type: "object",
      properties: {
        city: { type: "string" },
        country: { type: "string" },
        procedures: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "microchip",
              "rabies_vaccine",
              "rabies_titer",
              "dhpp_vaccine",
              "fvrcp_vaccine",
              "health_certificate",
              "endorsement_signature",
            ],
          },
        },
      },
      required: ["city", "country", "procedures"],
    },
  },
  {
    name: "read_vet_availability",
    description: "Read open slots for a vet within a date window.",
    input_schema: {
      type: "object",
      properties: {
        vet_id: { type: "string" },
        window_start: { type: "string", description: "YYYY-MM-DD inclusive" },
        window_end: { type: "string", description: "YYYY-MM-DD inclusive" },
      },
      required: ["vet_id", "window_start", "window_end"],
    },
  },
  {
    name: "emit_appointments",
    description:
      "Terminal: propose the appointment plan. Dates must respect every cited wait period (e.g. rabies → 21-day wait → endorsement) and fall before the case target_date.",
    input_schema: {
      type: "object",
      properties: {
        vet_id: { type: "string" },
        appointments: {
          type: "array",
          items: {
            type: "object",
            properties: {
              procedure: { type: "string" },
              date: { type: "string", description: "YYYY-MM-DD" },
              cited_rules: { type: "array", items: { type: "string" } },
            },
            required: ["procedure", "date", "cited_rules"],
          },
          minItems: 1,
        },
        notes: { type: "string" },
      },
      required: ["vet_id", "appointments"],
    },
  },
  {
    name: "request_clarification",
    description: "Terminal: ask Comms to clarify a fact we need before booking (city, preferred clinic, schedule constraint).",
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
    name: "fail_no_vet",
    description: "Terminal: no approved vet in the owner's region offers the required procedures. Routes to Orchestrator for re-routing or escalation.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string" },
        searched_procedures: { type: "array", items: { type: "string" } },
      },
      required: ["reason"],
    },
  },
];

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved vet and proposes appointment dates that satisfy every cited wait period.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: TOOLS,
  terminal_tools: ["emit_appointments", "request_clarification", "fail_no_vet"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
