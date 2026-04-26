import { Header } from "@/components/demo/Header";
import { ComingSoon } from "@/components/demo/ComingSoon";

export const metadata = { title: "Architecture · Vetair" };

export default function Architecture() {
  return (
    <>
      <Header />
      <ComingSoon
        eyebrow="Walkthrough 03"
        title="Architecture"
        session="Session 4"
        description="The receipts. Schema, agents, tools, dispatch chain, migration list. Not marketing — for the engineer Haitham brings to the follow-up meeting. Everything that makes the MAS work, laid out in SQL-queryable form."
        willShow={[
          "Full schema diagram: all tables, with FK relationships and RLS policies.",
          "All 6 agents with their system prompts, tool manifests, and model tiers.",
          "The dispatch chain: inbound WhatsApp → queue → orchestrator → specialist → queue → orchestrator.",
          "The global tool registry: 9 tools, their signatures, which agents can call them.",
          "Migration history: every DDL change signed and dated.",
          "Cost model: per-case breakdown by agent.",
        ]}
      />
    </>
  );
}
