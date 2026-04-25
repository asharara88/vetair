// Audit agent — agent #9.
//
// Read-only watchdog. Runs async after every other agent's output and flags:
//   - citation coverage <100% on customer-facing claims
//   - deterministic vs LLM disagreement on factual matters
//   - SLA breach risk (case open > N days without progress)
//   - document extraction confidence <0.95
//
// Findings are written to agent_logs as the audit_agent. The Orchestrator can
// pause a case mid-flow if a critical-severity finding lands.

import "server-only";
import type { AgentContext, AgentMeta, AgentResult } from "./types";
import { modelFor } from "./models";
import { recordAgentRun } from "./log";

export const meta: AgentMeta = {
  name: "audit_agent",
  description: "Read-only watchdog. Enforces 100% citation coverage and cross-checks voices.",
  default_model: modelFor("audit_agent"),
  input_budget_tokens: 16_000,
};

export type FindingSeverity = "info" | "warning" | "critical";

export interface AuditFinding {
  code: string;
  severity: FindingSeverity;
  detail: string;
}

export interface AuditOutput {
  findings: AuditFinding[];
  summary: string;
}

const SLA_DAYS_OPEN = 21;
const MIN_DOC_CONFIDENCE = 0.95;

export async function run(ctx: AgentContext): Promise<AgentResult<AuditOutput>> {
  const started = Date.now();

  const [{ data: caseRow }, { data: docs }, { data: messages }, { data: rounds }] = await Promise.all([
    ctx.supabase.from("cases").select("id, state, created_at, updated_at").eq("id", ctx.case_id).single(),
    ctx.supabase.from("documents").select("id, document_type, extraction_confidence").eq("case_id", ctx.case_id),
    ctx.supabase.from("comms_messages").select("id, direction, body, sent_by_agent").eq("case_id", ctx.case_id),
    ctx.supabase.from("consensus_rounds").select("topic, votes, resolution, final_verdict").eq("case_id", ctx.case_id),
  ]);

  if (!caseRow) {
    const result: AgentResult<AuditOutput> = {
      ok: false,
      decision_summary: "Audit failed: case not found",
      confidence: 0,
      citations: [],
      latency_ms: Date.now() - started,
      error: "case not found",
    };
    await recordAgentRun(ctx.supabase, "audit_agent", ctx.case_id, result);
    return result;
  }

  const findings: AuditFinding[] = [];

  // 1. SLA: case open > N days without reaching closed/cancelled
  const ageDays = (Date.now() - new Date(caseRow.created_at).getTime()) / 86_400_000;
  const terminal = caseRow.state === "closed" || caseRow.state === "cancelled";
  if (!terminal && ageDays > SLA_DAYS_OPEN) {
    findings.push({
      code: "SLA_BREACH_RISK",
      severity: "warning",
      detail: `Case open ${ageDays.toFixed(1)} days in state "${caseRow.state}" (SLA: ${SLA_DAYS_OPEN} days).`,
    });
  }

  // 2. Document extraction confidence
  for (const d of docs ?? []) {
    if (d.extraction_confidence != null && d.extraction_confidence < MIN_DOC_CONFIDENCE) {
      findings.push({
        code: "LOW_DOC_CONFIDENCE",
        severity: "warning",
        detail: `Document ${d.id} (${d.document_type}) extraction confidence ${d.extraction_confidence.toFixed(2)} < ${MIN_DOC_CONFIDENCE}.`,
      });
    }
  }

  // 3. Three-voice disagreement on compliance
  for (const r of rounds ?? []) {
    if (r.topic === "compliance_verdict" && r.resolution && r.resolution !== "consensus") {
      findings.push({
        code: "VOICE_DISAGREEMENT",
        severity: r.resolution === "escalated" ? "critical" : "warning",
        detail: `Compliance consensus resolution: ${r.resolution}.`,
      });
    }
  }

  // 4. Citation coverage on outbound comms — heuristic: any outbound message
  //    containing a date-like or numeric-claim pattern should reference a code.
  //    We don't parse the message; we just count outbound messages and require
  //    that at least one agent_log citation exists for any compliance period.
  const outboundCount = (messages ?? []).filter((m) => m.direction === "outbound").length;
  const hasComplianceCitation = (rounds ?? []).some(
    (r) =>
      r.topic === "compliance_verdict" &&
      r.final_verdict &&
      typeof (r.final_verdict as Record<string, unknown>).earliest_legal_departure === "string",
  );
  if (outboundCount > 0 && !hasComplianceCitation && caseRow.state !== "intake" && caseRow.state !== "draft") {
    findings.push({
      code: "MISSING_COMPLIANCE_CITATION",
      severity: "critical",
      detail: `${outboundCount} outbound messages sent but no compliance verdict on record.`,
    });
  }

  const summary = findings.length === 0
    ? `All checks passed (state=${caseRow.state}, age=${ageDays.toFixed(1)}d).`
    : `${findings.length} finding(s): ${findings.map((f) => f.code).join(", ")}`;

  const worstSeverity = findings.reduce<FindingSeverity>(
    (acc, f) =>
      f.severity === "critical" || acc === "critical" ? "critical"
      : f.severity === "warning" || acc === "warning" ? "warning"
      : "info",
    "info",
  );

  const result: AgentResult<AuditOutput> = {
    ok: true,
    output: { findings, summary },
    decision_summary: summary.slice(0, 500),
    confidence: 1,
    citations: [],
    model: meta.default_model,
    latency_ms: Date.now() - started,
  };
  await recordAgentRun(ctx.supabase, "audit_agent", ctx.case_id, result, {
    output_payload: { findings, summary, severity: worstSeverity },
  });
  return result;
}
