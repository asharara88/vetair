// Vetair demo-stream edge function.
// Streams a dramatized demo script over SSE, writing to the same tables as real-case-mode
// so the UI renders identically in both modes.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ScriptStep {
  step: number;
  agent: string;
  delay_ms: number;
  channel?: string;
  direction?: "inbound" | "outbound";
  text?: string;
  attachment?: string;
  action?: string;
  voice?: string;
  output?: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let body: { script_name: string; case_id?: string; speed?: number };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: cors }); }

  const scriptName = body.script_name;
  const speed = body.speed ?? 1;

  const { data: script, error } = await supabase.from("demo_scripts").select("*").eq("name", scriptName).single();
  if (error || !script) return new Response(JSON.stringify({ error: "script not found", detail: error?.message }), { status: 404, headers: cors });

  const steps: ScriptStep[] = script.steps as ScriptStep[];

  let caseId = body.case_id;
  if (!caseId) {
    const storyMeta = { sarah_max_uae_uk_v1: { owner: "Sarah Martinez", pet: "Max", breed: "Golden Retriever" }, james_luna_uae_uk_happy_path_v1: { owner: "James Fletcher", pet: "Luna", breed: "Border Collie" } };
    const meta = storyMeta[scriptName as keyof typeof storyMeta] ?? { owner: "Demo Owner", pet: "Demo Pet", breed: "Mixed" };
    const { data: owner } = await supabase.from("owners").insert({ full_name: meta.owner, whatsapp_number: "+971500000000", locale: "en", residence_country: "AE", destination_country: "GB" }).select("id").single();
    const { data: pet } = await supabase.from("pets").insert({ owner_id: owner!.id, name: meta.pet, species: "dog", breed: meta.breed }).select("id").single();
    const caseNum = `VTR-${Date.now().toString(36).toUpperCase()}`;
    const { data: caseRow } = await supabase.from("cases").insert({ owner_id: owner!.id, pet_id: pet!.id, case_number: caseNum, origin_country: "AE", destination_country: "GB", state: "intake", demo_mode: true }).select("id").single();
    caseId = caseRow!.id;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (evt: Record<string, unknown>) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));

      send({ type: "start", case_id: caseId, script: scriptName, total_steps: steps.length });

      for (const step of steps) {
        const delay = Math.max(100, Math.floor(step.delay_ms * speed));
        await new Promise((r) => setTimeout(r, delay));

        try {
          if (step.channel === "whatsapp" && step.text) {
            await supabase.from("comms_messages").insert({
              case_id: caseId, channel: "whatsapp",
              direction: step.direction ?? "outbound",
              body: step.text, sent_by_agent: step.agent,
              media_urls: step.attachment ? [step.attachment] : [],
              status: "sent",
            });
          }
          if (step.action) {
            await supabase.from("agent_logs").insert({
              case_id: caseId, agent_name: step.agent,
              model: step.voice === "opus47_auditor" ? "claude-opus-4-20250514" : step.voice === "ts_deterministic" ? "ts-v1" : "claude-sonnet-4-20250514",
              decision_summary: JSON.stringify(step.output ?? {}).slice(0, 500),
              confidence: 0.95,
              output_payload: step.output ?? {},
              latency_ms: step.delay_ms,
            });
          }
          if (step.action === "consensus_resolved" || step.action === "consensus_timeline") {
            const out = step.output ?? {};
            await supabase.from("consensus_rounds").insert({
              case_id: caseId,
              topic: (out.topic as string) ?? step.action,
              participants: ["deterministic", "compliance_primary", "compliance_auditor"],
              votes: [],
              resolution: (out.resolution as string) ?? "consensus",
              final_verdict: out,
              resolved_at: new Date().toISOString(),
            });
          }
          if (step.action === "case_closed_demo") {
            const out = (step.output ?? {}) as Record<string, unknown>;
            await supabase.from("cases").update({ state: (out.case_state as string) ?? "approved" }).eq("id", caseId);
          }
        } catch (e) {
          send({ type: "warning", step: step.step, error: (e as Error).message });
        }

        send({ type: "step", ...step });
      }

      send({ type: "complete", case_id: caseId });
      controller.close();
    },
  });

  return new Response(stream, { headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });
});
