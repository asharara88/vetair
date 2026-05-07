// Vet Network — match owner to an approved vet in their city, propose
// procedure dates (microchip, vaccine, titer, endorsement), and book.
// Procedure proposals feed the consensus timeline loop (see AGENT.md §2.2).

import { type AgentDefinition, validateAgent } from "./types";
import {
  acknowledgeAndWaitTool,
  caseIdInputSchema,
  readCaseTool,
  readPetFactsTool,
} from "./tools";

const PROCEDURE_ENUM = ["microchip", "rabies_vaccine", "titer_test", "endorsement", "health_cert"] as const;

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved vet in the origin city and proposes appointment dates for required procedures. Date proposals feed the consensus timeline loop.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    readCaseTool(),
    readPetFactsTool(),
    {
      name: "find_approved_vets",
      description:
        "Search the approved vet panel by origin city + species. Returns vets with available procedures and earliest open slots.",
      input_schema: {
        type: "object",
        properties: {
          city: { type: "string" },
          country: { type: "string" },
          species: { type: "string" },
          procedures: { type: "array", items: { type: "string", enum: [...PROCEDURE_ENUM] } },
        },
        required: ["country", "procedures"],
      },
    },
    {
      name: "propose_appointment",
      description:
        "Propose an appointment as an entry in the consensus timeline. Caller does not book — Orchestrator runs feasibility against Airline + Endorsement proposals first.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          procedure: { type: "string", enum: [...PROCEDURE_ENUM] },
          proposed_date: { type: "string", description: "ISO YYYY-MM-DD" },
          rationale: { type: "string" },
        },
        required: ["case_id", "vet_id", "procedure", "proposed_date"],
      },
    },
    {
      name: "book_appointment",
      description:
        "Terminal: confirm a booking after Orchestrator approves the proposal. Writes the appointment to the schedule and sends the owner the calendar invite via Comms.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          procedure: { type: "string", enum: [...PROCEDURE_ENUM] },
          confirmed_date: { type: "string" },
          confirmed_time: { type: "string", description: "HH:MM in vet local timezone" },
        },
        required: ["case_id", "vet_id", "procedure", "confirmed_date"],
      },
    },
    {
      name: "no_vets_available",
      description:
        "Terminal: no approved vet in the corridor can offer the required procedure within the case's target window. Escalates to Orchestrator.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
    acknowledgeAndWaitTool(
      "Terminal: yield without proposing. Use when the case's procedures are already booked.",
    ),
    {
      name: "list_pending_procedures",
      description:
        "Read which procedures the case still needs (derived from compliance assessment + booked appointments).",
      input_schema: caseIdInputSchema(),
    },
  ],
  terminal_tools: ["book_appointment", "no_vets_available", "acknowledge_and_wait"],
  budget: { max_turns: 6, max_input_tokens: 40_000 },
});
