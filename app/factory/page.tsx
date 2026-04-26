import { Header } from "@/components/demo/Header";
import { ComingSoon } from "@/components/demo/ComingSoon";

export const metadata = { title: "Factory · Vetair" };

export default function Factory() {
  return (
    <>
      <Header />
      <ComingSoon
        eyebrow="Walkthrough 02"
        title="The Factory"
        session="Session 3"
        description="The moat. Pick a country, watch the Synthesizer agent compile a new specialist from a template, validate its tool manifest, and register it in production. Same specialist, invoked seconds later, produces a real compliance verdict. First Japan case pays $0.03 of synthesis; every case after reuses it."
        willShow={[
          "Live view of agent_templates — what blueprints exist today.",
          "Live view of synthesized_specialists — what specialists have been spawned.",
          "A country picker. Select one, trigger synthesis, watch it complete in real time.",
          "The Synthesizer’s tool calls: list_templates → read_template → check_existing → register_specialist.",
          "The new specialist appears in the registry and is immediately callable.",
          "Second synthesis of the same country: dedup fires, same specialist returned, zero new rows.",
        ]}
      />
    </>
  );
}
