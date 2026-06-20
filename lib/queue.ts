// Inter-agent task queue helper.
// Wraps inserts into the `task_queue` table so callers don't need to know the
// row shape, and so a missing table (e.g. before the session-6 migration is
// applied) degrades to a logged warning instead of a 500.
//
// Schema (per AGENT.md §4.3):
//   task_queue(id, source_agent, target_agent, case_id, task_type, priority,
//              payload jsonb, status, created_at, claimed_at, completed_at)

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TaskType =
  | "document_extract"   // a comms_messages row has inbound media; run extractDocument
  | "intake"             // first-touch from an unknown phone; start a new case
  | "compliance"         // run the compliance loop
  | "audit"              // run the auditor on a fresh assessment
  | "comms"              // generate an outbound owner message
  | "synthesize";        // synthesize a country specialist before dispatch

export type TaskPriority = "low" | "normal" | "high";

export interface EnqueueArgs {
  source_agent: string;
  target_agent: string;
  task_type: TaskType;
  case_id?: string | null;
  payload?: Record<string, unknown>;
  priority?: TaskPriority;
}

export interface EnqueueResult {
  ok: boolean;
  task_id?: string;
  error?: string;
  skipped?: boolean; // true when the table doesn't exist yet
}

const MISSING_TABLE_HINTS = ["42P01", "PGRST205", "relation", "does not exist"];

function looksLikeMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message ?? "").toLowerCase();
  return MISSING_TABLE_HINTS.some((h) => err.code === h || msg.includes(h.toLowerCase()));
}

export async function enqueueTask(
  supabase: SupabaseClient,
  args: EnqueueArgs,
): Promise<EnqueueResult> {
  const { data, error } = await supabase
    .from("task_queue")
    .insert({
      source_agent: args.source_agent,
      target_agent: args.target_agent,
      task_type: args.task_type,
      case_id: args.case_id ?? null,
      payload: args.payload ?? {},
      priority: args.priority ?? "normal",
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    if (looksLikeMissingTable(error)) {
      console.warn(`[queue] task_queue table not present — skipped ${args.task_type} task`);
      return { ok: false, skipped: true, error: error.message };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, task_id: data?.id };
}
