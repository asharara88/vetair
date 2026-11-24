// Vetair · intake-agent v1
// Conversational onboarding after an inbound WhatsApp message.
// Fired by the webhook (or orchestrator) once an owner is matched to an active
// case in state draft|intake. Reads the thread, decides the next field to
// capture, optionally patches pet/case facts, and either:
//   - ask_user_for_input    → sends one WhatsApp question, yields.
//   - handoff_to_compliance → enqueues the compliance task, yields.
//
// Non-terminal tools (send_reply, request_document, update_case_facts,
// update_pet_facts) can be called mid-loop to acknowledge an upload, patch
// known facts, or post a short reply before the next question.
//
// Follows the same conventions as orchestrator v9 / exception_handler:
// agent_runs row per invocation, agent_turns per LLM turn, demo_mode skip,
// terminal-tool pattern, fail-soft.

import {
  type JsonObj,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  anthropicChat,
  AnthropicError,
  closeRun,
  clipToolResult,
  jsonResponse,
  openRun,
  supaClient,
  tokenCost,
  toolUses,
} from "../_shared/agent-runtime.ts";

const MODEL = "claude-haiku-4-5";
const MAX_TURNS = 6;
const MAX_TOKENS_PER_TURN = 1024;

const TERMINAL_TOOLS = new Set(["ask_user_for_input", "handoff_to_compliance"]);

const DOC_KINDS = ["rabies", "microchip", "passport", "vet_records"] as const;

// ──────────────────────────────────────────────────────────────────────────
// Patch allow-lists — anything the model writes via an update_* tool must be
// in the matching set. The patch payloads are owner-controlled WhatsApp text
// laundered through an LLM, so we never let them touch workflow state,
// identity columns, or anything a bad actor could use to pivot across cases.
// ──────────────────────────────────────────────────────────────────────────
const OWNER_PATCH_ALLOWED = new Set(["full_name", "email", "locale"]);
const CASE_PATCH_ALLOWED = new Set([
  "origin_country",
  "destination_country",
  "target_date",
  "service_tier",
]);
const PET_PATCH_ALLOWED = new Set([
  "name",
  "species",
  "breed",
  "weight_kg",
  "date_of_birth",
  "microchip_id",
  "microchip_implant_date",
  "color",
  "sex",
  "photo_url",
]);

function pickAllowed(patch: JsonObj, allowed: Set<string>): JsonObj {
  const out: JsonObj = {};
  for (const [k, v] of Object.entries(patch)) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

const TOOLS = [
  {
    name: "send_reply",
    description: "Send a free-form WhatsApp reply on the active thread. Use sparingly — most turns should be an ask_user_for_input question.",
    input_schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
  {
    name: "request_document",
    description: "Ask the owner to upload a specific document type (rabies | microchip | passport | vet_records). Sends a templated WhatsApp prompt.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: [...DOC_KINDS] },
      },
      required: ["kind"],
    },
  },
  {
    name: "update_owner_facts",
    description: "Patch the owner row with confirmed owner-supplied fields. Only full_name, email, locale are accepted; other keys are silently dropped.",
    input_schema: {
      type: "object",
      properties: {
        patch: {
          type: "object",
          properties: {
            full_name: { type: "string" },
            email: { type: "string" },
            locale: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      required: ["patch"],
    },
  },
  {
    name: "update_case_facts",
    description: "Patch the case row with confirmed owner-supplied fields. Only origin_country, destination_country, target_date, service_tier are accepted; other keys (state, owner_id, pet_id, demo_mode, …) are silently dropped.",
    input_schema: {
      type: "object",
      properties: {
        patch: {
          type: "object",
          properties: {
            origin_country: { type: "string" },
            destination_country: { type: "string" },
            target_date: { type: "string", description: "ISO date YYYY-MM-DD" },
            service_tier: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      required: ["patch"],
    },
  },
  {
    name: "update_pet_facts",
    description: "Patch the pet row with confirmed owner-supplied fields. Only name, species, breed, weight_kg, date_of_birth, microchip_id, microchip_implant_date, color, sex, photo_url are accepted; other keys are silently dropped.",
    input_schema: {
      type: "object",
      properties: {
        patch: {
          type: "object",
          properties: {
            name: { type: "string" },
            species: { type: "string", enum: ["dog", "cat", "ferret"] },
            breed: { type: "string" },
            weight_kg: { type: "number" },
            date_of_birth: { type: "string", description: "ISO date YYYY-MM-DD" },
            microchip_id: { type: "string" },
            microchip_implant_date: { type: "string", description: "ISO date YYYY-MM-DD" },
            color: { type: "string" },
            sex: { type: "string" },
            photo_url: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      required: ["patch"],
    },
  },
  {
    name: "ask_user_for_input",
    description: "TERMINAL. Send a single-question WhatsApp prompt and yield until the owner replies. Exactly one question — never multi-prompt.",
    input_schema: {
      type: "object",
      properties: {
        field: { type: "string", description: "Canonical name of the field being captured (owner_name, destination_country, species, breed, date_of_birth, microchip_id, target_date)." },
        question: { type: "string" },
      },
      required: ["field", "question"],
    },
  },
  {
    name: "handoff_to_compliance",
    description: "TERMINAL. All required intake fields are captured. Enqueues the compliance assessment task and yields.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

const SYSTEM_PROMPT = `You are the Intake agent for Vetair, a pet-relocation Multi-Agent System. You onboard a pet owner over WhatsApp into a structured case.

CONTEXT YOU WILL SEE:
 - case (id, state, origin_country, destination_country, target_date)
 - owner (full_name, whatsapp_number)
 - pet (name, species, breed, date_of_birth, microchip_id, microchip_implant_date)
 - recent_thread: the last few WhatsApp turns both directions

CAPTURE ORDER (strict; do not skip ahead):
 1. owner full name
 2. destination country
 3. species (dog | cat | ferret)
 4. breed
 5. date of birth
 6. microchip status (has it / needs one)
 7. target travel window (a target_date)

RULES:
 - One question per turn. Never list multiple questions in a single message.
 - If a field is already set in context, SKIP that step and move to the next missing one.
 - If the owner sent a document in the recent_thread, call update_pet_facts with any inferable fact and move on — do not ask them to retype document contents.
 - Be warm, never breezy. On the very first intake turn, acknowledge that pet relocation is stressful before asking.
 - As soon as owner.full_name + case.destination_country + pet.species + case.target_date are set, call handoff_to_compliance. Do not over-collect.
 - Persist the owner's confirmed name via update_owner_facts (field: full_name), destination/target_date via update_case_facts, and pet facts via update_pet_facts. Do NOT write workflow or identity columns — the schemas above enumerate what each tool accepts.
 - You MAY call non-terminal tools (update_owner_facts, update_case_facts, update_pet_facts, send_reply, request_document) in the SAME turn before the terminal — e.g. patch a fact you just confirmed, then ask the next question.
 - Never invent regulatory facts. Intake does not quote rules.

OUTPUT:
 Tool calls only. No free-text output outside tools.`;

const supa = supaClient();

// ── Context readers ───────────────────────────────────────────────────────

interface CaseCtx {
  id: string;
  case_number: string | null;
  state: string;
  origin_country: string | null;
  destination_country: string | null;
  target_date: string | null;
  owner_id: string;
  pet_id: string | null;
  demo_mode: boolean;
}

async function readIntakeContext(caseId: string): Promise<JsonObj | null> {
  const { data: caseRow } = await supa
    .from("cases")
    .select("id, case_number, state, origin_country, destination_country, target_date, owner_id, pet_id, demo_mode")
    .eq("id", caseId)
    .maybeSingle();
  if (!caseRow) return null;

  const ownerQ = supa
    .from("owners")
    .select("id, full_name, whatsapp_number")
    .eq("id", caseRow.owner_id)
    .maybeSingle();

  const petQ = caseRow.pet_id
    ? supa
        .from("pets")
        .select("id, name, species, breed, date_of_birth, microchip_id, microchip_implant_date")
        .eq("id", caseRow.pet_id)
        .maybeSingle()
    : Promise.resolve({ data: null });

  const threadQ = supa
    .from("comms_messages")
    .select("direction, body, media_urls, created_at")
    .eq("case_id", caseId)
    .eq("channel", "whatsapp")
    .order("created_at", { ascending: false })
    .limit(10);

  const [ownerR, petR, threadR] = await Promise.all([ownerQ, petQ, threadQ]);

  return {
    case: {
      id: caseRow.id,
      case_number: caseRow.case_number,
      state: caseRow.state,
      origin_country: caseRow.origin_country,
      destination_country: caseRow.destination_country,
      target_date: caseRow.target_date,
    },
    owner: ownerR.data,
    pet: petR.data,
    recent_thread: (threadR.data ?? []).reverse(),
  };
}

// ── Side-effect executors ─────────────────────────────────────────────────

async function sendWhatsApp(caseId: string, ownerId: string, body: string): Promise<void> {
  // Insert pending outbound row; whatsapp-send upgrades it to sent.
  await supa.from("comms_messages").insert({
    case_id: caseId,
    owner_id: ownerId,
    channel: "whatsapp",
    direction: "outbound",
    thread_id: ownerId,
    body,
    status: "pending",
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ case_id: caseId, owner_id: ownerId, body }),
      signal: controller.signal,
    });
  } catch (_e) {
    /* fire-and-forget; whatsapp-send also persists outbound rows */
  } finally {
    clearTimeout(timer);
  }
}

const DOC_PROMPTS: Record<typeof DOC_KINDS[number], string> = {
  rabies: "Could you send a photo of the rabies vaccination certificate? Both sides if there's info on the back.",
  microchip: "Could you send the microchip certificate or any paperwork with the chip number and implant date?",
  passport: "Could you send the pet passport, especially the ID page and vaccination section?",
  vet_records: "Could you send any recent vet records — the last year is enough.",
};

// `petRef.current` is mutated the first time a pet row is created so a
// later update_pet_facts in the SAME run updates that row instead of
// inserting a second one.
interface ExecCtx {
  caseId: string;
  ownerId: string;
  petRef: { current: string | null };
}

async function executeNonTerminal(
  ctx: ExecCtx,
  tool: { name: string; input: JsonObj },
): Promise<JsonObj> {
  const { caseId, ownerId, petRef } = ctx;
  try {
    if (tool.name === "send_reply") {
      const text = String(tool.input.text ?? "");
      if (!text) return { error: "send_reply: empty text" };
      await sendWhatsApp(caseId, ownerId, text);
      return { ok: true, sent: true };
    }
    if (tool.name === "request_document") {
      const kind = String(tool.input.kind ?? "") as typeof DOC_KINDS[number];
      const prompt = DOC_PROMPTS[kind];
      if (!prompt) return { error: `request_document: unknown kind ${kind}` };
      await sendWhatsApp(caseId, ownerId, prompt);
      return { ok: true, requested: kind };
    }
    if (tool.name === "update_owner_facts") {
      const patch = pickAllowed((tool.input.patch as JsonObj) ?? {}, OWNER_PATCH_ALLOWED);
      if (Object.keys(patch).length === 0) return { error: "update_owner_facts: no allowed keys in patch" };
      await supa.from("owners").update(patch).eq("id", ownerId);
      return { ok: true, patched: Object.keys(patch) };
    }
    if (tool.name === "update_case_facts") {
      const patch = pickAllowed((tool.input.patch as JsonObj) ?? {}, CASE_PATCH_ALLOWED);
      if (Object.keys(patch).length === 0) return { error: "update_case_facts: no allowed keys in patch" };
      await supa.from("cases").update(patch).eq("id", caseId);
      return { ok: true, patched: Object.keys(patch) };
    }
    if (tool.name === "update_pet_facts") {
      const patch = pickAllowed((tool.input.patch as JsonObj) ?? {}, PET_PATCH_ALLOWED);
      if (Object.keys(patch).length === 0) return { error: "update_pet_facts: no allowed keys in patch" };
      if (petRef.current) {
        await supa.from("pets").update(patch).eq("id", petRef.current);
        return { ok: true, patched: Object.keys(patch), pet_id: petRef.current };
      }
      // No pet row yet — create one with these facts and link to the case.
      const { data: newPet } = await supa.from("pets").insert(patch).select("id").single();
      if (newPet?.id) {
        petRef.current = newPet.id as string;
        await supa.from("cases").update({ pet_id: newPet.id }).eq("id", caseId);
        return { ok: true, patched: Object.keys(patch), pet_id: newPet.id, created: true };
      }
      return { error: "update_pet_facts: pet insert failed" };
    }
    return { error: `unknown non-terminal tool: ${tool.name}` };
  } catch (e) {
    return { error: `tool_failed:${tool.name}`, detail: String(e) };
  }
}

async function executeTerminal(
  ctx: { caseId: string; ownerId: string; runId: string },
  tool: { name: string; input: JsonObj },
): Promise<JsonObj> {
  const { caseId, ownerId, runId } = ctx;
  if (tool.name === "ask_user_for_input") {
    const question = String(tool.input.question ?? "");
    const field = String(tool.input.field ?? "unknown");
    if (!question) return { ok: false, error: "empty question" };
    await sendWhatsApp(caseId, ownerId, question);
    await supa.from("cases").update({ state: "intake" }).eq("id", caseId);
    // Record the pending field on the run itself so the next invocation can
    // see it without requiring a cases-table schema change.
    await supa.from("agent_messages").insert({
      case_id: caseId,
      from_agent: "intake",
      to_agent: "intake",
      message_type: "state",
      subject: `awaiting:${field}`,
      payload: { field, question },
      source_run_id: runId,
    });
    return { ok: true, asked: field };
  }
  if (tool.name === "handoff_to_compliance") {
    await supa.from("cases").update({ state: "assessment" }).eq("id", caseId);
    await supa.from("orchestrator_queue").insert({
      case_id: caseId,
      trigger_event: "intake_complete",
      trigger_ref: `intake:${runId}`,
      payload: {},
      state: "pending",
    });
    return { ok: true, handoff: "compliance" };
  }
  return { ok: false, error: `unknown terminal: ${tool.name}` };
}

// ── Main handler ──────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  try {
    const body = await req.json();
    const caseId = body.case_id as string | undefined;
    const trigger = (body.trigger as string) ?? "manual";
    if (!caseId) return jsonResponse({ error: "case_id required" }, 400);

    const { data: caseLookup } = await supa
      .from("cases")
      .select("id, demo_mode, owner_id, pet_id")
      .eq("id", caseId)
      .maybeSingle();
    if (!caseLookup) return jsonResponse({ error: "case_not_found" }, 404);
    if (caseLookup.demo_mode) {
      return jsonResponse({ status: "skipped", reason: "demo_mode" });
    }

    const runId = await openRun(supa, {
      case_id: caseId,
      agent_name: "intake",
      model: MODEL,
      triggered_by: trigger,
    });
    if (!runId) return jsonResponse({ error: "run_insert_failed" }, 500);

    const context = await readIntakeContext(caseId);
    if (!context) {
      await closeRun(supa, { run_id: runId, state: "failed", error_message: "context_load_failed" });
      return jsonResponse({ error: "context_load_failed" }, 500);
    }

    const messages: JsonObj[] = [{
      role: "user",
      content: `Intake turn for case ${caseId}. Trigger: ${trigger}.\n\nContext:\n${JSON.stringify(context, null, 2)}\n\nDecide the next field to capture and act. End with ask_user_for_input or handoff_to_compliance.`,
    }];

    let terminalTool: string | null = null;
    let terminalPayload: JsonObj | null = null;
    let terminalReason: string | null = null;
    let totalIn = 0, totalOut = 0, totalCost = 0, turnIdx = 0;

    const ownerId = caseLookup.owner_id as string;
    const petRef = { current: (caseLookup.pet_id as string | null) ?? null };
    const nonTerminalCtx: ExecCtx = { caseId, ownerId, petRef };
    const terminalCtx = { caseId, ownerId, runId };

    outer: for (let turn = 0; turn < MAX_TURNS; turn++) {
      const t0 = Date.now();
      let resp;
      try {
        resp = await anthropicChat({
          model: MODEL,
          system: SYSTEM_PROMPT,
          tools: TOOLS,
          messages,
          max_tokens: MAX_TOKENS_PER_TURN,
        });
      } catch (e) {
        const detail = e instanceof AnthropicError ? e.body : String(e);
        await closeRun(supa, {
          run_id: runId,
          state: "failed",
          error_message: `anthropic_api_error: ${detail}`,
          turn_count: turnIdx,
          total_input_tokens: totalIn,
          total_output_tokens: totalOut,
          total_cost_usd: totalCost,
        });
        return jsonResponse({ error: "anthropic_api_error", detail }, 502);
      }
      const latencyMs = Date.now() - t0;
      const turnCost = tokenCost(MODEL, resp.usage.input_tokens, resp.usage.output_tokens);
      totalIn += resp.usage.input_tokens;
      totalOut += resp.usage.output_tokens;
      totalCost += turnCost;

      await supa.from("agent_turns").insert({
        run_id: runId,
        turn_index: turnIdx,
        kind: "assistant",
        stop_reason: resp.stop_reason,
        content: resp.content,
        tool_calls: toolUses(resp),
        input_tokens: resp.usage.input_tokens,
        output_tokens: resp.usage.output_tokens,
        cost_usd: turnCost,
        latency_ms: latencyMs,
      });
      messages.push({ role: "assistant", content: resp.content });

      const uses = toolUses(resp);
      if (resp.stop_reason !== "tool_use" || uses.length === 0) {
        terminalReason = `ended_without_terminal:${resp.stop_reason}`;
        break;
      }

      turnIdx += 1;
      const toolResults: JsonObj[] = [];
      for (const tu of uses) {
        if (!tu.name) continue;
        if (TERMINAL_TOOLS.has(tu.name)) {
          terminalTool = tu.name;
          terminalPayload = tu.input ?? {};
          terminalReason = `agent_chose_${tu.name}`;
          // Record a synthetic tool_result so the assistant block stays balanced.
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: "terminal" });
          await supa.from("agent_turns").insert({ run_id: runId, turn_index: turnIdx, kind: "tool_result", content: toolResults });
          break outer;
        }
        const res = await executeNonTerminal(nonTerminalCtx, { name: tu.name, input: tu.input ?? {} });
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: clipToolResult(res) });
      }
      await supa.from("agent_turns").insert({ run_id: runId, turn_index: turnIdx, kind: "tool_result", content: toolResults });
      messages.push({ role: "user", content: toolResults });
      turnIdx += 1;
    }

    if (!terminalReason) terminalReason = "budget_exhausted";

    let terminalResult: JsonObj = { executed: false };
    if (terminalTool && terminalPayload) {
      terminalResult = await executeTerminal(terminalCtx, { name: terminalTool, input: terminalPayload });
    }

    await closeRun(supa, {
      run_id: runId,
      state: terminalTool ? "complete" : "failed_no_terminal",
      terminal_tool: terminalTool,
      terminal_reason: terminalReason,
      turn_count: turnIdx,
      total_input_tokens: totalIn,
      total_output_tokens: totalOut,
      total_cost_usd: totalCost,
    });

    return jsonResponse({
      status: "ok",
      run_id: runId,
      terminal_tool: terminalTool,
      terminal_payload: terminalPayload,
      terminal_result: terminalResult,
      cost_usd: totalCost,
    });
  } catch (e) {
    return jsonResponse({ error: "intake_unhandled", detail: String(e) }, 500);
  }
});
