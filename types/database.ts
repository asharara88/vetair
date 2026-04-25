// Database types — hand-written to match the Supabase schema.
// Regenerate with `supabase gen types typescript --project-id yydnaisrgwiuuiespagi > types/database.ts` once CLI is set up.

export type CaseState =
  | "draft" | "intake" | "assessment" | "blocked" | "approved"
  | "documentation" | "vet_procedures" | "booking" | "transit"
  | "arrived" | "closed" | "cancelled";

export type Species = "dog" | "cat" | "bird" | "rabbit" | "ferret" | "other";

export type RuleStatus = "satisfied" | "pending" | "blocked" | "not_applicable";

export type RequirementType =
  | "microchip" | "vaccine" | "titer" | "endorsement" | "permit"
  | "health_cert" | "breed_restriction" | "age_restriction" | "carrier_rule";

export type AgentName =
  | "orchestrator"
  | "intake_agent" | "document_agent"
  | "compliance_primary" | "compliance_auditor" | "deterministic_engine"
  | "vet_network_agent" | "airline_crate_agent" | "endorsement_agent"
  | "comms_agent" | "audit_agent";

export interface Owner {
  id: string;
  full_name: string;
  whatsapp_number: string | null;
  email: string | null;
  locale: string;
  residence_country: string | null;
  destination_country: string | null;
  created_at: string;
  updated_at: string;
}

export interface Pet {
  id: string;
  owner_id: string;
  name: string;
  species: Species;
  breed: string | null;
  date_of_birth: string | null;
  weight_kg: number | null;
  microchip_id: string | null;
  microchip_implant_date: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Case {
  id: string;
  owner_id: string;
  pet_id: string;
  case_number: string;
  origin_country: string;
  origin_city: string | null;
  destination_country: string;
  destination_city: string | null;
  target_date: string | null;
  earliest_legal_departure: string | null;
  state: CaseState;
  service_tier: "standard" | "concierge" | "vip";
  quote_amount_usd: number | null;
  demo_mode: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommsMessage {
  id: string;
  case_id: string;
  owner_id: string | null;
  channel: "whatsapp" | "email" | "sms" | "ui";
  direction: "inbound" | "outbound";
  thread_id: string | null;
  whatsapp_message_id: string | null;
  body: string;
  media_urls: string[];
  sent_by_agent: string | null;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  created_at: string;
}

export interface AgentLog {
  id: string;
  case_id: string | null;
  agent_name: string;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  latency_ms: number | null;
  decision_summary: string | null;
  confidence: number | null;
  citations: unknown;
  input_payload: unknown;
  output_payload: unknown;
  error_message: string | null;
  created_at: string;
}

export interface ConsensusRound {
  id: string;
  case_id: string;
  topic: string;
  round_number: number;
  participants: string[];
  votes: Array<{ voice: string; verdict: string }>;
  resolution: "consensus" | "disagreement" | "escalated" | "timeout" | null;
  final_verdict: {
    verdict?: "approved" | "blocked" | "pending";
    earliest_legal_departure?: string | null;
    three_voices?: {
      deterministic?: { verdict?: string; rationale?: string };
      primary?: { verdict?: string; rationale?: string; model?: string };
      auditor?: { verdict?: string; rationale?: string; model?: string };
    };
    [key: string]: unknown;
  } | null;
  disagreement_details: string | null;
  started_at: string;
  resolved_at: string | null;
}

export interface DemoScript {
  id: string;
  name: string;
  description: string | null;
  corridor: string | null;
  steps: Array<{
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
  }>;
  is_active: boolean;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  case_id: string;
  document_type: string;
  storage_path: string | null;
  source_url: string | null;
  mime_type: string | null;
  extracted_fields: Record<string, unknown>;
  extraction_confidence: number | null;
  verified: boolean;
  uploaded_by_owner: boolean;
  created_at: string;
}

export interface CountryRule {
  id: string;
  origin_country: string;
  destination_country: string;
  species: Species;
  requirement_code: string;
  title: string;
  requirement_type: RequirementType;
  evidence_schema: Record<string, unknown>;
  time_constraints: Record<string, unknown> | null;
  evaluator_fn_name: string | null;
  authoritative_source: string | null;
  source_url: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
}

export interface RequirementEvaluation {
  id: string;
  case_id: string;
  country_rule_id: string;
  status: RuleStatus;
  evidence_document_ids: string[];
  evaluator: "deterministic" | "compliance_primary" | "compliance_auditor";
  confidence: number | null;
  notes: string | null;
  earliest_legal_date: string | null;
  blocking_reason: string | null;
  created_at: string;
}

export type TaskStatus = "queued" | "in_progress" | "completed" | "failed" | "cancelled";

export interface TaskQueueItem {
  id: string;
  case_id: string;
  source_agent: AgentName | null;
  target_agent: AgentName;
  task_type: string;
  priority: number;
  payload: Record<string, unknown>;
  status: TaskStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface StreamEvent {
  type: "start" | "step" | "complete" | "warning";
  case_id?: string;
  script?: string;
  total_steps?: number;
  step?: number;
  agent?: string;
  delay_ms?: number;
  channel?: string;
  direction?: "inbound" | "outbound";
  text?: string;
  attachment?: string;
  action?: string;
  voice?: string;
  output?: Record<string, unknown>;
  error?: string;
}
