// Endorsement — schedules the official health-certificate endorsement window
// (MOCCAE in UAE, APHA in the UK, USDA in the US, etc.) and tracks the courier
// trip. Strict 10-day-pre-travel window; closes the loop with the airline date.

import { type AgentDefinition, validateAgent } from "./types";

export const ENDORSEMENT: AgentDefinition = validateAgent({
  name: "endorsement",
  type: "endorsement",
  model: "claude-sonnet-4-6",
  user_facing_label: "Endorsement Team",
  description:
    "Schedules official health-certificate endorsement (MOCCAE / APHA / USDA) inside the 10-day pre-travel window and tracks courier delivery.",
  prompt_path: "lib/prompts/endorsement.md",
  tools: [
    {
      name: "read_health_certificate",
      description: "Read the case's most recent health_certificate document — drives the issue_date pivot.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "read_booking",
      description: "Read the confirmed airline booking to lock the flight date for the endorsement window.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "find_endorsement_slots",
      description: "Query the destination authority's appointment portal (or its scraped cache) for slots in a date window.",
      input_schema: {
        type: "object",
        properties: {
          authority: { type: "string", enum: ["MOCCAE", "APHA", "USDA", "CFIA"] },
          earliest_date: { type: "string", description: "ISO date" },
          latest_date: { type: "string", description: "ISO date" },
        },
        required: ["authority", "earliest_date", "latest_date"],
      },
    },
    {
      name: "book_endorsement",
      description:
        "Terminal: reserve the endorsement slot and dispatch a courier task. Window must cover the 10-day pre-travel constraint and the health certificate must already be issued.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          authority: { type: "string", enum: ["MOCCAE", "APHA", "USDA", "CFIA"] },
          slot_id: { type: "string" },
          appointment_date: { type: "string", description: "ISO date" },
          courier_required: { type: "boolean" },
        },
        required: ["case_id", "authority", "slot_id", "appointment_date", "courier_required"],
      },
    },
    {
      name: "block_endorsement",
      description:
        "Terminal: no slot fits the 10-day window, or the health certificate is missing/expired. Returns the blocker for human routing.",
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
  terminal_tools: ["book_endorsement", "block_endorsement"],
  budget: { max_turns: 5, max_input_tokens: 30_000 },
});
