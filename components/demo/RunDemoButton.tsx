"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DemoResult {
  ok?: boolean;
  case_number?: string;
  scenario?: {
    owner: string;
    pet: string;
    breed: string;
    origin: string;
    destination: string;
    destination_name: string;
  };
  agent_chain?: string[];
  synthesis_needed?: boolean;
  error?: string;
  message?: string;
}

export function RunDemoButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);

  const handleClick = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/run-demo", { method: "POST" });
      const data: DemoResult = await res.json();
      setResult(data);
      router.refresh();
      [8000, 16000, 24000].forEach((delay) =>
        setTimeout(() => router.refresh(), delay),
      );
    } catch (e) {
      setResult({ error: String(e) });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={running}
        className="inline-flex items-center justify-center gap-2 px-4 py-3 font-mono text-2xs uppercase tracking-widest transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed bg-amber-500 text-ink-950 hover:bg-amber-400 inset-glow w-full"
      >
        {running ? (
          <>
            <span className="signal-dot animate-pulse" style={{ color: "currentColor" }} />
            Spawning case…
          </>
        ) : (
          <>Run a demo case <span>→</span></>
        )}
      </button>

      {result?.ok && result.scenario && (
        <div className="border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
          <p className="font-mono text-2xs uppercase tracking-widest text-amber-400">
            Case {result.case_number}
          </p>
          <p className="text-sm text-ink-100 font-display">
            {result.scenario.owner} · {result.scenario.pet} ({result.scenario.breed})
          </p>
          <p className="font-mono text-2xs text-ink-400">
            {result.scenario.origin} → {result.scenario.destination_name}
          </p>
          {result.agent_chain && (
            <p className="font-mono text-2xs text-ink-500 mt-2 pt-2 border-t border-ink-700/40">
              Routing: {result.agent_chain.join(" → ")}
              {result.synthesis_needed && " · synthesizing new specialist"}
            </p>
          )}
          <p className="font-mono text-2xs text-ink-500">
            Watch the receipts panel update as each agent completes.
          </p>
        </div>
      )}

      {result?.error && (
        <div className="border border-signal-stop/30 bg-signal-stop/5 p-3">
          <p className="font-mono text-2xs uppercase tracking-widest text-signal-stop">
            {result.error}
          </p>
          {result.message && (
            <p className="font-mono text-2xs text-ink-400 mt-1">{result.message}</p>
          )}
        </div>
      )}

      <p className="font-mono text-2xs text-ink-500 leading-relaxed">
        Spawns a real case (random scenario across UAE → UK / JP / FR / SG) and runs it through
        the full agent chain. If the destination has no specialist, the Synthesizer creates one
        on the spot.
      </p>
    </div>
  );
}
