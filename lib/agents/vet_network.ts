// Vet Network — books the pre-flight veterinary appointment.
// Triggered after compliance flags a missing health certificate or rabies titre
// where the owner lacks an eligible vet. Selects from the partner_vets registry,
// then asks the owner to confirm before booking.

import { type AgentDefinition, validateAgent } from "./types";
import { ACKNOWLEDGE_AND_WAIT_TOOL, READ_CASE_TOOL } from "./shared";

export const VET_NETWORK: AgentDefinition = validateAgent({
  name: "vet_network",
  type: "vet_network",
  model: "claude-haiku-4-5",
  user_facing_label: "Vet Network",
  description:
    "Books the pre-flight vet appointment. Matches the case to a partner clinic licensed to endorse for the destination corridor and proposes an appointment.",
  prompt_path: "lib/prompts/vet_network.md",
  tools: [
    READ_CASE_TOOL,
    {
      name: "find_partner_vets",
      description:
        "Search partner_vets filtered by origin city + endorsement authority for the destination corridor. Returns clinics with their next available slots.",
      input_schema: {
        type: "object",
        properties: {
          city: { type: "string" },
          country_code: { type: "string", description: "ISO-3166 alpha-2 of the origin country." },
          endorsement_authority: {
            type: "string",
            description: "Authority that must accredit the vet (e.g. USDA-APHIS, DEFRA, MOCCAE).",
          },
          species: { type: "string" },
        },
        required: ["city", "country_code", "endorsement_authority"],
      },
    },
    {
      name: "read_pet_facts",
      description: "Read pet facts (species, breed, weight) needed to prefill the appointment form.",
      input_schema: {
        type: "object",
        properties: { case_id: { type: "string" } },
        required: ["case_id"],
      },
    },
    {
      name: "propose_appointment",
      description:
        "Terminal: hold a tentative slot at a partner clinic. The slot is reserved for 24h pending owner confirmation; expiry is enforced at the partner_vets adapter, not in this loop.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          partner_vet_id: { type: "string" },
          slot_start: { type: "string", description: "ISO-8601 datetime." },
          services: {
            type: "array",
            items: {
              type: "string",
              enum: ["health_certificate", "rabies_vaccination", "rabies_titre", "microchip_implant", "examination"],
            },
            minItems: 1,
          },
        },
        required: ["case_id", "partner_vet_id", "slot_start", "services"],
      },
    },
    {
      name: "no_match",
      description:
        "Terminal: no partner clinic in the corridor can cover the requested services. Comms must offer an out-of-network referral.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["case_id", "reason"],
      },
    },
    ACKNOWLEDGE_AND_WAIT_TOOL,
  ],
  terminal_tools: ["propose_appointment", "no_match", "acknowledge_and_wait"],
  budget: { max_turns: 4, max_input_tokens: 30_000 },
});
