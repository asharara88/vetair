// Static agent registry — the static side of the MAS roster.
// Kept separate from `index.ts` so dispatch helpers can import the lookup
// table without forming a cycle with the public barrel.
//
// Synthesized specialists are NOT listed here; they live in the
// `synthesized_specialists` table and are reconstructed at dispatch time via
// `buildSpecialist`. Use `resolveAgent` in `./dispatch.ts` for unified lookup.

import type { AgentDefinition } from "./types";
import { ORCHESTRATOR } from "./orchestrator";
import { INTAKE } from "./intake";
import { DOCUMENT } from "./document";
import { COMPLIANCE } from "./compliance";
import { AUDITOR } from "./auditor";
import { COMMS } from "./comms";
import { SYNTHESIZER } from "./synthesizer";

export const STATIC_AGENTS: readonly AgentDefinition[] = [
  ORCHESTRATOR,
  INTAKE,
  DOCUMENT,
  COMPLIANCE,
  AUDITOR,
  COMMS,
  SYNTHESIZER,
] as const;

export const STATIC_AGENTS_BY_NAME: Readonly<Record<string, AgentDefinition>> =
  Object.freeze(Object.fromEntries(STATIC_AGENTS.map((a) => [a.name, a])));

/**
 * Resolve a static agent definition by `agent_runs.agent_name`.
 *
 * Returns `null` for synthesized specialists — for those, use
 * `resolveAgent` from `./dispatch.ts` which knows how to construct one
 * from a `synthesized_specialists` row.
 */
export function resolveStaticAgent(name: string): AgentDefinition | null {
  return STATIC_AGENTS_BY_NAME[name] ?? null;
}
