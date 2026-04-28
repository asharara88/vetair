import { serverSupabase } from "@/lib/supabase-server";
import { Panel, Pill } from "@/components/ui/primitives";
import {
  formatCost, formatTokens, modelFamily, durationBetween, runRowSignal,
} from "@/lib/utils";

interface RunRow {
  id: string;
  agent_name: string;
  model: string;
  state: string;
  terminal_tool: string | null;
  terminal_reason: string | null;
  turn_count: number;
  total_cost_usd: number | string | null;
  total_input_tokens: number | null;
  total_output_tokens: number | null;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

interface MessageRow {
  id: string;
  from_agent: string;
  to_agent: string;
  message_type: string;
  subject: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

interface AssessmentRow {
  id: string;
  verdict: string;
  summary: string | null;
  cited_rules: string[] | null;
  requirements_missing: unknown;
  round: number;
  created_at: string;
}

interface AuditRow {
  id: string;
  verdict: string;
  reasoning: string | null;
  challenges: unknown;
  round: number;
  created_at: string;
}

interface CaseRow {
  id: string;
  case_number: string;
  origin_country: string;
  destination_country: string;
  state: string;
  assessment_state: string;
  target_date: string | null;
  created_at: string;
}

interface OwnerRow { full_name: string; whatsapp_number: string; }
interface PetRow { name: string; species: string; breed: string | null; microchip_id: string | null; }

export async function CaseTimeline({ caseId }: { caseId: string }) {
  const supabase = await serverSupabase();

  const [caseRes, runsRes, msgsRes, assessRes, auditRes] = await Promise.all([
    supabase.from("cases").select("id, case_number, origin_country, destination_country, state, assessment_state, target_date, created_at, owner_id, pet_id").eq("id", caseId).maybeSingle(),
    supabase.from("agent_runs").select("id, agent_name, model, state, terminal_tool, terminal_reason, turn_count, total_cost_usd, total_input_tokens, total_output_tokens, started_at, completed_at, error_message").eq("case_id", caseId).order("started_at", { ascending: true }),
    supabase.from("agent_messages").select("id, from_agent, to_agent, message_type, subject, payload, created_at").eq("case_id", caseId).order("created_at", { ascending: true }),
    supabase.from("compliance_assessments").select("id, verdict, summary, cited_rules, requirements_missing, round, created_at").eq("case_id", caseId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("audit_reviews").select("id, verdict, reasoning, challenges, round, created_at").eq("case_id", caseId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const caseRow = caseRes.data as (CaseRow & { owner_id: string; pet_id: string | null }) | null;
  if (!caseRow) {
    return (
      <Panel eyebrow="Timeline" title="Case not found">
        <p className="font-mono text-2xs uppercase tracking-widest text-ink-500 py-8 text-center">
          No case with that ID
        </p>
      </Panel>
    );
  }

  const [ownerRes, petRes] = await Promise.all([
    supabase.from("owners").select("full_name, whatsapp_number").eq("id", caseRow.owner_id).maybeSingle(),
    caseRow.pet_id
      ? supabase.from("pets").select("name, species, breed, microchip_id").eq("id", caseRow.pet_id).maybeSingle()
      : Promise.resolve({ data: null as PetRow | null }),
  ]);

  const owner = ownerRes.data as OwnerRow | null;
  const pet = petRes.data as PetRow | null;
  const runs: RunRow[] = (runsRes.data ?? []) as RunRow[];
  const messages: MessageRow[] = (msgsRes.data ?? []) as MessageRow[];
  const assessment: AssessmentRow | null = (assessRes.data as AssessmentRow | null) ?? null;
  const audit: AuditRow | null = (auditRes.data as AuditRow | null) ?? null;

  const totalTokens = runs.reduce((acc, r) => acc + (r.total_input_tokens ?? 0) + (r.total_output_tokens ?? 0), 0);
  const totalCost = runs.reduce((acc, r) => acc + Number(r.total_cost_usd ?? 0), 0);
  const totalTurns = runs.reduce((acc, r) => acc + r.turn_count, 0);

  return (
    <div className="space-y-5">
      <Panel eyebrow={caseRow.case_number} title={caseRow.origin_country + " → " + caseRow.destination_country}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Field label="Owner" value={owner?.full_name ?? "—"} />
          <Field label="WhatsApp" value={owner?.whatsapp_number ?? "—"} mono />
          <Field label="Pet" value={pet ? (pet.name + " · " + (pet.breed ?? pet.species)) : "—"} />
          <Field label="Microchip" value={pet?.microchip_id ?? "—"} mono />
          <Field label="Target date" value={caseRow.target_date ?? "—"} mono />
          <Field label="Assessment state" value={caseRow.assessment_state.replace(/_/g, " ")} />
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-ink-700/40">
          <Pill tone="amber">{runs.length} agent runs</Pill>
          <Pill tone="neutral">{totalTurns} total turns</Pill>
          <Pill tone="neutral">{formatTokens(totalTokens)} tokens</Pill>
          <Pill tone="neutral">{formatCost(totalCost)} compute</Pill>
        </div>
      </Panel>

      <Panel eyebrow="Timeline" title="Agent runs">
        {runs.length === 0 && (
          <p className="font-mono text-2xs uppercase tracking-widest text-ink-500 py-8 text-center">
            No runs yet on this case
          </p>
        )}
        <div className="space-y-3">
          {runs.map((r, i) => {
            const signal = runRowSignal(r.state, r.terminal_tool);
            return (
              <div key={r.id} className="relative pl-7">
                <span className="absolute left-0 top-3 w-3 h-3 rounded-full bg-amber-500" />
                {i < runs.length - 1 && (
                  <span className="absolute left-1.5 top-6 bottom-0 w-px bg-ink-700/60" />
                )}
                <div className="border border-ink-700/50 bg-ink-900/20 p-3">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <div className="flex items-baseline gap-3">
                      <span className="font-display text-ink-100">{r.agent_name}</span>
                      <Pill tone={signal.tone}>{signal.label}</Pill>
                    </div>
                    <span className="font-mono text-2xs text-ink-500 tabular-nums">
                      {modelFamily(r.model)} · {r.turn_count}t · {formatTokens(r.total_input_tokens)}/{formatTokens(r.total_output_tokens)} · {formatCost(r.total_cost_usd)} · {durationBetween(r.started_at, r.completed_at)}
                    </span>
                  </div>
                  {r.terminal_reason && r.terminal_reason !== ("agent_chose_" + r.terminal_tool) && (
                    <p className="font-mono text-2xs text-ink-500 mt-2">{r.terminal_reason}</p>
                  )}
                  {r.error_message && (
                    <p className="font-mono text-2xs text-signal-stop mt-2">{r.error_message}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {assessment && (
        <Panel eyebrow="Compliance" title={"Verdict: " + assessment.verdict.replace(/_/g, " ") + (assessment.round > 1 ? (" · round " + assessment.round) : "")}>
          {assessment.summary && (
            <p className="text-sm text-ink-300 leading-relaxed mb-4">{assessment.summary}</p>
          )}
          {assessment.cited_rules && assessment.cited_rules.length > 0 && (
            <div className="mb-3">
              <p className="font-mono text-2xs uppercase tracking-widest text-amber-400 mb-2">Cited sources</p>
              <ul className="space-y-1">
                {assessment.cited_rules.slice(0, 6).map((r, i) => (
                  <li key={i} className="font-mono text-2xs text-ink-400 break-all">{r}</li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(assessment.requirements_missing) && assessment.requirements_missing.length > 0 && (
            <div>
              <p className="font-mono text-2xs uppercase tracking-widest text-amber-400 mb-2">
                Requirements missing ({(assessment.requirements_missing as unknown[]).length})
              </p>
              <ul className="space-y-1.5">
                {(assessment.requirements_missing as Array<Record<string, unknown>>).slice(0, 6).map((req, i) => (
                  <li key={i} className="text-sm text-ink-300">
                    <span className="font-mono text-2xs text-ink-500 mr-2">{(req.requirement_code as string) ?? ("#" + (i + 1))}</span>
                    {(req.what_needed as string) ?? (req.reason as string) ?? JSON.stringify(req)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      )}

      {audit && (
        <Panel eyebrow="Audit" title={(audit.verdict === "concur" ? "Concurred" : "Dissented") + (audit.round > 1 ? (" · round " + audit.round) : "")}>
          {audit.reasoning && (
            <p className="text-sm text-ink-300 leading-relaxed">{audit.reasoning}</p>
          )}
          {Array.isArray(audit.challenges) && audit.challenges.length > 0 && (
            <div className="mt-3">
              <p className="font-mono text-2xs uppercase tracking-widest text-signal-stop mb-2">
                Challenges ({(audit.challenges as unknown[]).length})
              </p>
              <ul className="space-y-1.5">
                {(audit.challenges as Array<Record<string, unknown>>).slice(0, 4).map((ch, i) => (
                  <li key={i} className="text-sm text-ink-300">
                    {(ch.challenge as string) ?? (ch.summary as string) ?? JSON.stringify(ch)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      )}

      {messages.length > 0 && (
        <Panel eyebrow="Inter-agent" title="Messages">
          <div className="space-y-2">
            {messages.map((m) => (
              <div key={m.id} className="flex items-baseline gap-3 py-1.5">
                <span className="font-mono text-2xs text-ink-500 tabular-nums w-24 flex-shrink-0">
                  {new Date(m.created_at).toLocaleTimeString()}
                </span>
                <span className="font-mono text-2xs text-ink-400 w-32 flex-shrink-0 truncate">
                  {m.from_agent}
                </span>
                <span className="font-mono text-2xs text-ink-500">→</span>
                <span className="font-mono text-2xs text-ink-400 w-24 flex-shrink-0 truncate">
                  {m.to_agent}
                </span>
                <span className="text-sm text-ink-300 flex-1 min-w-0 truncate">
                  {m.subject ?? m.message_type}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="font-mono text-2xs uppercase tracking-widest text-ink-500 mb-0.5">{label}</p>
      <p className={mono ? "font-mono text-sm text-ink-100" : "text-sm text-ink-100"}>{value}</p>
    </div>
  );
}
