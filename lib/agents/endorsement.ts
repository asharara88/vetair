// Endorsement — manages the official health-certificate endorsement window.
// MOCCAE (UAE), APHA (UK), USDA-APHIS (US) all require a vet-signed health
// certificate endorsed by the government within a tight pre-flight window
// (typically 7–10 days). This agent owns timing, submission, and courier
// tracking against that window.

import { type AgentDefinition, validateAgent } from "./types";

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Owns the endorsement window (7–10 days pre-flight). Schedules the vet appointment, submits to MOCCAE / APHA / USDA-APHIS, tracks the courier.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_booking",
      description:
        "Read the locked booking (carrier, depart_iso, arrive_iso) so the endorsement window can be computed.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_assessment",
      description: "Read the latest compliance assessment to confirm required endorsement codes.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "compute_endorsement_window",
      description:
        "Compute the [earliest, latest] window for the endorsement appointment given depart_iso and the destination's pre-flight constraint.",
      input_schema: {
        type: "object",
        properties: {
          depart_iso: { type: "string" },
          destination_country: { type: "string" },
        },
        required: ["depart_iso", "destination_country"],
      },
    },
    {
      name: "propose_endorsement_appointment",
      description:
        "Hand the endorsement-procedure booking to the vet_network agent within the computed window. Non-terminal.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          earliest_iso: { type: "string" },
          latest_iso: { type: "string" },
        },
        required: ["case_id", "earliest_iso", "latest_iso"],
      },
    },
    {
      name: "submit_endorsement",
      description:
        "Terminal: submit the signed health certificate to the destination authority's portal (MOCCAE, APHA, USDA-APHIS). Records the submission id and courier tracking.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: ["MOCCAE", "APHA", "USDA-APHIS"] },
          submission_ref: { type: "string" },
          courier: { type: "string" },
          courier_tracking: { type: "string" },
        },
        required: ["case_id", "authority", "submission_ref"],
      },
    },
    {
      name: "block_endorsement",
      description:
        "Terminal: window cannot be honoured (booking too soon, vet unavailable). Returns to orchestrator with a concrete reason.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
    {
      name: "acknowledge_and_wait",
      description:
        "Terminal: yield — e.g. waiting for the vet appointment to complete before submission can begin.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
  ],
  terminal_tools: ["submit_endorsement", "block_endorsement", "acknowledge_and_wait"],
  budget: { max_turns: 5, max_input_tokens: 30_000 },
});
