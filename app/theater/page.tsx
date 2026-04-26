import { Header } from "@/components/demo/Header";
import { ComingSoon } from "@/components/demo/ComingSoon";

export const metadata = { title: "Case Theater · Vetair" };

export default function Theater() {
  return (
    <>
      <Header />
      <ComingSoon
        eyebrow="Walkthrough 01"
        title="Case Theater"
        session="Session 2"
        description="Watch a real case move through the Multi-Agent System in real time. Agent badges, turn-by-turn tool calls, cost meter, inter-agent messages — every decision rendered as it happened. First case: XL Bully, rejected under the Dangerous Dogs Act."
        willShow={[
          "The full agent timeline: intake → compliance → auditor → orchestrator → close_case.",
          "Each agent’s tool calls rendered as chips with their arguments and results.",
          "Live cost meter: $0.51 accumulated across 14 turns.",
          "Inter-agent messages: compliance’s handoff to auditor, auditor’s concur verdict, orchestrator’s final close.",
          "A ‘replay’ button that re-runs the cascade against a fresh case ID.",
        ]}
      />
    </>
  );
}
