// Endorsement — 10-day window timing, MOCCAE / APHA / DEFRA submission,
// courier tracking. Proposes a window; the consensus timeline votes.

import { type AgentDefinition, validateAgent } from "./types";
import { READ_ASSESSMENT_TOOL, READ_CASE_TOOL } from "./tools";

const AUTHORITIES = ["MOCCAE", "APHA", "DEFRA", "USDA_APHIS", "CFIA"] as const;

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "logistics",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement",
  description:
    "Times the official endorsement window against the flight date and submits the package to the relevant authority (MOCCAE / APHA / DEFRA).",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    READ_CASE_TOOL,
    READ_ASSESSMENT_TOOL,
    {
      name: "read_country_rules",
      description:
        "Read the country_rules entries that describe the endorsement window for this corridor (typical: 7–10 days pre-flight).",
      input_schema: {
        type: "object",
        properties: {
          origin: { type: "string" },
          destination: { type: "string" },
          species: { type: "string" },
        },
        required: ["origin", "destination", "species"],
      },
    },
    {
      name: "read_booking",
      description:
        "Read the accepted flight booking proposal (route_id, flight_date) so the endorsement window can be aligned.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "propose_endorsement_window",
      description:
        "Terminal: propose the endorsement appointment window. Orchestrator votes; do not assume acceptance.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: [...AUTHORITIES] },
          window_start: { type: "string", description: "ISO date YYYY-MM-DD." },
          window_end: { type: "string", description: "ISO date YYYY-MM-DD." },
          rationale: { type: "string" },
        },
        required: ["case_id", "authority", "window_start", "window_end", "rationale"],
      },
    },
    {
      name: "submit_endorsement",
      description:
        "Terminal: submit the prepared endorsement package once the window opens. Returns a tracking_id from the courier or e-portal.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: [...AUTHORITIES] },
          courier: {
            type: "string",
            enum: ["aramex", "dhl", "fedex", "in_person", "e_portal"],
          },
          package_id: { type: "string" },
        },
        required: ["case_id", "authority", "courier", "package_id"],
      },
    },
    {
      name: "fail_endorsement",
      description:
        "Terminal: abort. Use when the endorsement window cannot align with the booked flight, or required documents are missing.",
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
  terminal_tools: [
    "propose_endorsement_window",
    "submit_endorsement",
    "fail_endorsement",
  ],
  budget: { max_turns: 5, max_input_tokens: 40_000 },
});
