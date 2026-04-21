import { notFound } from "next/navigation";
import { serverSupabase } from "@/lib/supabase-server";
import { Header } from "@/components/demo/Header";
import { LiveCaseView } from "@/components/demo/LiveCaseView";
import type {
  AgentLog, Case, CommsMessage, ConsensusRound, Owner, Pet,
} from "@/types/database";

export const dynamic = "force-dynamic";

export default async function CasePage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ script?: string }>;
}) {
  const { id } = await params;
  const search = await searchParams;
  const supabase = await serverSupabase();

  const { data: caseRow } = await supabase.from("cases").select("*").eq("id", id).single();
  if (!caseRow) return notFound();

  const [ownerRes, petRes] = await Promise.all([
    supabase.from("owners").select("*").eq("id", caseRow.owner_id).single(),
    supabase.from("pets").select("*").eq("id", caseRow.pet_id).single(),
  ]);

  const species = (petRes.data as Pet | null)?.species ?? "dog";

  const [logsRes, msgsRes, roundsRes, reqRes, evalRes] = await Promise.all([
    supabase.from("agent_logs").select("*").eq("case_id", id).order("created_at", { ascending: true }),
    supabase.from("comms_messages").select("*").eq("case_id", id).order("created_at", { ascending: true }),
    supabase.from("consensus_rounds").select("*").eq("case_id", id).order("started_at", { ascending: true }),
    supabase.from("country_rules").select("id, requirement_code, title, requirement_type, priority, source_url")
      .eq("origin_country", caseRow.origin_country)
      .eq("destination_country", caseRow.destination_country)
      .eq("species", species)
      .eq("is_active", true),
    supabase.from("requirement_evaluations").select("country_rule_id, status, notes, evaluator, earliest_legal_date, blocking_reason").eq("case_id", id),
  ]);

  return (
    <>
      <Header />
      <LiveCaseView
        initialCase={caseRow as Case}
        owner={ownerRes.data as Owner}
        pet={petRes.data as Pet}
        streamScript={search.script}
        initialLogs={(logsRes.data as AgentLog[] | null) ?? []}
        initialMessages={(msgsRes.data as CommsMessage[] | null) ?? []}
        initialRounds={(roundsRes.data as ConsensusRound[] | null) ?? []}
        requirements={(reqRes.data ?? []) as {
          id: string; requirement_code: string; title: string; requirement_type: string; priority: number; source_url: string | null;
        }[]}
        initialEvaluations={(evalRes.data ?? []) as {
          country_rule_id: string; status: "satisfied" | "pending" | "blocked" | "not_applicable"; notes: string | null; evaluator: string; earliest_legal_date: string | null; blocking_reason: string | null;
        }[]}
      />
    </>
  );
}
