// Vet Network — matches the owner to an approved local vet and proposes
// appointment dates for the regulated procedures (microchip, vaccine, titer,
// endorsement). One of the three "proposers" in the consensus timeline loop
// (§2.2 of AGENT.md) — it does not commit appointments by itself.

import { type AgentDefinition, validateAgent } from "./types";

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Matches the owner to an approved local vet and proposes microchip / vaccine / titer / endorsement appointment dates.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    {
      name: "read_owner_location",
      description: "Read the owner's residence (city + country) used to scope the vet search.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "list_approved_vets",
      description:
        "List approved vets within a radius of the owner. Filters to MOCCAE/APHA-listed practitioners when the destination requires one.",
      input_schema: {
        type: "object",
        properties: {
          country: { type: "string" },
          city: { type: "string" },
          requires_endorser: { type: "boolean" },
          radius_km: { type: "integer", minimum: 1, maximum: 100 },
        },
        required: ["country", "city"],
      },
    },
    {
      name: "list_required_procedures",
      description:
        "List procedures the case still needs (microchip, rabies, titer, health_cert, endorsement) with their earliest_legal_date if known.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "propose_appointment",
      description:
        "Propose a single appointment. Non-terminal: an agent may propose several before emitting a timeline.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          procedure: {
            type: "string",
            enum: ["microchip", "rabies", "titer", "health_certificate", "endorsement"],
          },
          earliest_date: { type: "string", description: "YYYY-MM-DD" },
          latest_date: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["case_id", "vet_id", "procedure", "earliest_date", "latest_date"],
      },
    },
    {
      name: "emit_timeline_proposal",
      description:
        "Terminal: emit the full set of proposed appointments for the consensus round. The Orchestrator runs feasibility against airline/endorsement proposals.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          vet_id: { type: "string" },
          items: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                procedure: { type: "string" },
                earliest_date: { type: "string" },
                latest_date: { type: "string" },
              },
              required: ["procedure", "earliest_date", "latest_date"],
            },
          },
          cited_rules: {
            type: "array",
            items: { type: "string" },
            description: "Requirement codes that justify the proposed dates.",
          },
        },
        required: ["case_id", "vet_id", "items", "cited_rules"],
      },
    },
    {
      name: "fail_no_match",
      description:
        "Terminal: no approved vet within range can serve the required procedures. Hands back to Orchestrator for human-assisted sourcing.",
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
  terminal_tools: ["emit_timeline_proposal", "fail_no_match"],
  budget: { max_turns: 5, max_input_tokens: 30_000 },
});
