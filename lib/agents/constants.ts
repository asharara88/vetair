// Shared enums used in tool input_schemas across agents.
// Co-locating these here removes the per-agent string-literal duplication
// (document kinds were inlined in 4 files; channels and model ids in 2+) and
// lets the dispatcher / UI consume a single source of truth.

import type { ModelId } from "./types";

// Document kinds that any agent (intake, compliance, specialist, comms) can
// ask the owner to upload. Extend here, not at each call site.
export const DOCUMENT_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
  "import_permit",
  "endorsement",
  "confirm_destination",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

// Subsets — intake never asks for a permit/endorsement; only specialist asks
// for confirm_destination. Centralized so the variants don't drift.
export const INTAKE_DOCUMENT_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
] as const;

export const COMPLIANCE_DOCUMENT_KINDS = [
  "rabies",
  "microchip",
  "passport",
  "vet_records",
  "import_permit",
  "endorsement",
] as const;

// Owner-facing channels.
export const COMMS_CHANNELS = ["whatsapp", "email", "sms"] as const;
export type CommsChannel = (typeof COMMS_CHANNELS)[number];

// Channels that support templated nudges (request_document doesn't make sense
// on SMS — too short for a useful upload prompt).
export const REQUEST_DOCUMENT_CHANNELS = ["whatsapp", "email"] as const;

// Model ids the synthesizer may pin. Mirrors ModelId in types.ts at runtime so
// JSON-schema enum lists derive from the same source as the TS type.
export const MODEL_IDS: readonly ModelId[] = [
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
] as const;
