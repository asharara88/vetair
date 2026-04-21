// Database types — hand-written to match the Supabase schema.
// Regenerate with `supabase gen types typescript --project-id yydnaisrgwiuuiespagi > types/database.ts` once CLI is set up.

export type CaseState =
  | "draft" | "intake" | "assessment" | "blocked" | "approved"
  | "documentation" | "vet_procedures" | "booking" | "transit"
  | "arrived" | "closed" | "cancelled";

export type Species = "dog" | "cat" | "bird" | "rabbit" | "ferret" | "other";

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
