// Public surface of the agent roster. The Orchestrator dispatches by name;
// nothing else should import the concrete modules directly.

import "server-only";
import type { AgentName } from "@/types/database";
import type { AgentContext, AgentMeta, AgentResult } from "./types";

import { meta as orchestratorMeta, run as orchestratorRun } from "./orchestrator";
import { meta as intakeMeta, run as intakeRun } from "./intake";
import { meta as documentMeta, run as documentRun } from "./document";
import { meta as complianceMeta, run as complianceRun } from "./compliance";
import { meta as complianceAuditorMeta, run as complianceAuditorRun } from "./compliance_auditor";
import { meta as vetNetworkMeta, run as vetNetworkRun } from "./vet_network";
import { meta as airlineCrateMeta, run as airlineCrateRun } from "./airline_crate";
import { meta as endorsementMeta, run as endorsementRun } from "./endorsement";
import { meta as commsMeta, run as commsRun } from "./comms";
import { meta as auditMeta, run as auditRun } from "./audit";

// Per AGENT.md §2.1, the deterministic engine is "not an agent, a set of functions".
// It has no run() entry — it's invoked synchronously by the compliance edge function.

type RegistryEntry = { meta: AgentMeta; run: (ctx: AgentContext) => Promise<AgentResult> };

export const AGENT_REGISTRY: Record<Exclude<AgentName, "deterministic_engine">, RegistryEntry> = {
  orchestrator:        { meta: orchestratorMeta,       run: orchestratorRun },
  intake_agent:        { meta: intakeMeta,             run: intakeRun },
  document_agent:      { meta: documentMeta,           run: documentRun },
  compliance_primary:  { meta: complianceMeta,         run: complianceRun },
  compliance_auditor:  { meta: complianceAuditorMeta,  run: complianceAuditorRun as RegistryEntry["run"] },
  vet_network_agent:   { meta: vetNetworkMeta,         run: vetNetworkRun },
  airline_crate_agent: { meta: airlineCrateMeta,       run: airlineCrateRun },
  endorsement_agent:   { meta: endorsementMeta,        run: endorsementRun },
  comms_agent:         { meta: commsMeta,              run: commsRun as RegistryEntry["run"] },
  audit_agent:         { meta: auditMeta,              run: auditRun },
};

export async function dispatch(agent: AgentName, ctx: AgentContext): Promise<AgentResult> {
  if (agent === "deterministic_engine") {
    throw new Error("deterministic_engine is invoked via lib/compliance/evaluators.ts, not the agent registry");
  }
  const entry = AGENT_REGISTRY[agent];
  if (!entry) throw new Error(`unknown agent ${agent}`);
  return entry.run(ctx);
}

export type { AgentContext, AgentMeta, AgentResult } from "./types";
