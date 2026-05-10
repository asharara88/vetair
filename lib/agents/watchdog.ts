// Watchdog — read-only async monitor over the polyphonic spine.
// Flags citation gaps, deterministic-vs-LLM disagreement, low extraction
// confidence, and SLA risk back to the orchestrator. Never speaks to the owner.

import { type AgentDefinition, validateAgent } from "./types";
import { acknowledgeAndWaitTool, caseIdInput } from "./tool-schemas";

const FINDING_KINDS = [
  "citation_gap",
  "deterministic_disagreement",
  "low_extraction_confidence",
  "sla_risk",
  "loop_detected",
] as const;

const SEVERITIES = ["info", "warn", "block"] as const;

export const WATCHDOG: AgentDefinition = validateAgent({
  name: "watchdog",
  type: "watchdog",
  model: "claude-haiku-4-5",
  user_facing_label: "Audit Watchdog",
  description:
    "Read-only async watchdog. Flags citation gaps, deterministic-vs-LLM disagreement, low extraction confidence, and SLA risk back to the orchestrator.",
  prompt_path: "lib/prompts/watchdog.md",
  tools: [
    {
      name: "read_recent_runs",
      description:
        "Read the last N agent_runs for a case so cross-agent invariants can be checked.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
        required: ["case_id"],
      },
    },
    {
      name: "read_assessment",
      description: "Read the most recent compliance assessment for a case.",
      input_schema: caseIdInput(),
    },
    {
      name: "read_documents",
      description:
        "Read all documents linked to a case, including extraction confidence.",
      input_schema: caseIdInput(),
    },
    {
      name: "read_outbound_messages",
      description:
        "Read every outbound owner-facing message for a case, with their cited_rules. Used for citation-coverage audits.",
      input_schema: caseIdInput(),
    },
    {
      name: "run_deterministic",
      description:
        "Re-run the deterministic TS evaluator for a single requirement_code. Used to compare against the primary's verdict.",
      input_schema: {
        type: "object",
        properties: { rule_code: { type: "string" } },
        required: ["rule_code"],
      },
    },
    {
      name: "emit_finding",
      description:
        "Terminal: write a watchdog finding. `severity=block` pauses the case until the orchestrator resolves it; `warn` is logged; `info` is informational only.",
      input_schema: {
        type: "object",
        properties: {
          case_id: { type: "string" },
          kind: { type: "string", enum: [...FINDING_KINDS] },
          severity: { type: "string", enum: [...SEVERITIES] },
          subject: { type: "string", description: "Short headline, max 80 chars." },
          detail: { type: "string" },
          cited_rules: {
            type: "array",
            items: { type: "string" },
            description:
              "Requirement codes the finding refers to. Empty for SLA / loop findings.",
          },
        },
        required: ["case_id", "kind", "severity", "subject", "detail"],
      },
    },
    acknowledgeAndWaitTool,
  ],
  terminal_tools: ["emit_finding", "acknowledge_and_wait"],
  budget: { max_turns: 4, max_input_tokens: 40_000 },
});
