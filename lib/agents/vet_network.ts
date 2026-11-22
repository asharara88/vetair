// Vet Network — matches the owner to an approved clinic in the origin country
// and proposes appointment dates (microchip, rabies vaccine, titer, OV endorsement)
// that satisfy the compliance timeline. Writes a proposal into a consensus round;
// the Orchestrator's timeline loop validates it against Airline/Crate and Endorsement.

import { type AgentDefinition, type AgentTool, validateAgent } from "./types";

const APPOINTMENT_KINDS = [
  "microchip",
  "rabies_vaccine",
  "titer_draw",
  "titer_followup",
  "ov_examination",
  "ov_endorsement",
] as const;

const SHARED_READ_TOOLS: AgentTool[] = [
  {
    name: "read_case",
    description:
      "Read the case row — origin, destination, target_date, earliest_legal_departure, service_tier.",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  },
  {
    name: "read_requirements",
    description:
      "Read requirement_evaluations for the case so you know which services still need booking (status = pending|blocked).",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  },
  {
    name: "list_approved_vets",
    description:
      "Return approved vet clinics for the owner's residence country that offer the requested service_types. Filtered by locality + USDA/MOCCAE accreditation where relevant.",
    input_schema: {
      type: "object",
      properties: {
        country_code: { type: "string", description: "ISO-3166 alpha-2 of the owner's residence." },
        service_types: {
          type: "array",
          items: { type: "string", enum: [...APPOINTMENT_KINDS] },
          minItems: 1,
        },
        near_postal_code: { type: "string" },
      },
      required: ["country_code", "service_types"],
    },
  },
  {
    name: "read_vet_capacity",
    description:
      "Read the clinic's declared capacity window around the target_date. Returns {date, open_slots[]}[] for the requested service_type.",
    input_schema: {
      type: "object",
      properties: {
        vet_id: { type: "string" },
        service_type: { type: "string", enum: [...APPOINTMENT_KINDS] },
        window_start: { type: "string", description: "YYYY-MM-DD" },
        window_end: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["vet_id", "service_type", "window_start", "window_end"],
    },
  },
];

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved clinic and proposes appointment dates for microchip, vaccine, titer, and OV endorsement. Writes a timeline proposal into the consensus round.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    ...SHARED_READ_TOOLS,
    {
      name: "propose_vet_plan",
      description:
        "Terminal: write a vet-side timeline proposal into the active consensus_round. Each appointment must list a requirement_code it discharges and fall on or after the deterministic earliest_legal_date.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          appointments: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                kind: { type: "string", enum: [...APPOINTMENT_KINDS] },
                date: { type: "string", description: "YYYY-MM-DD" },
                requirement_code: { type: "string" },
                notes: { type: "string" },
              },
              required: ["kind", "date", "requirement_code"],
            },
          },
        },
        required: ["case_id", "vet_id", "appointments"],
      },
    },
    {
      name: "request_document",
      description: "Terminal: ask Comms to prompt the owner for a document the vet will need (e.g. prior rabies record).",
      input_schema: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["rabies", "microchip", "passport", "vet_records", "titer_record"],
          },
        },
        required: ["kind"],
      },
    },
    {
      name: "escalate_no_capacity",
      description:
        "Terminal: no approved clinic can satisfy the window. Orchestrator will widen the target window or escalate.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
          earliest_feasible: { type: "string", description: "YYYY-MM-DD — the next date any approved clinic could meet." },
        },
        required: ["case_id", "reason"],
      },
    },
    {
      name: "acknowledge_and_wait",
      description: "Terminal: no action needed (e.g. owner has not yet confirmed target_date). Yield.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: ["propose_vet_plan", "request_document", "escalate_no_capacity", "acknowledge_and_wait"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
