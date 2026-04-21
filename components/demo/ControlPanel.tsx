"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DemoScript } from "@/types/database";
import { Panel, Pill, Button, Divider } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Mode = "dramatized" | "real";

export function ControlPanel({ scripts }: { scripts: DemoScript[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("dramatized");
  const [selectedScript, setSelectedScript] = useState<string>(
    scripts[0]?.name ?? "",
  );
  const [speed, setSpeed] = useState<number>(1);
  const [targetWhatsapp, setTargetWhatsapp] = useState<string>("");
  const [launching, setLaunching] = useState(false);

  const launch = async () => {
    setLaunching(true);
    try {
      if (mode === "dramatized") {
        // /api/demo/stream launches the Supabase edge function and returns the seeded case_id
        const res = await fetch("/api/demo/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            script_name: selectedScript,
            speed,
            target_whatsapp_number: targetWhatsapp.trim() || undefined,
          }),
        });
        const { case_id } = await res.json();
        if (case_id) router.push(`/cases/${case_id}?script=${selectedScript}`);
      } else {
        // Real-case-mode creates a fresh blank case and opens the live view; owner uploads data inside
        const res = await fetch("/api/cases", { method: "POST" });
        const { case_id } = await res.json();
        if (case_id) router.push(`/cases/${case_id}`);
      }
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Panel eyebrow="01 · Control" title="Launch a case">
      <div className="space-y-6">
        {/* Mode selector */}
        <div>
          <p className="font-mono text-2xs uppercase tracking-widest text-ink-400 mb-3">
            Mode
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(["dramatized", "real"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "p-4 text-left border transition-all",
                  mode === m
                    ? "border-amber-500 bg-amber-500/5 inset-glow"
                    : "border-ink-700 bg-ink-900/40 hover:border-ink-600",
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-display text-ink-100">
                    {m === "dramatized" ? "Dramatized" : "Real"}
                  </span>
                  {mode === m && <Pill tone="amber">Selected</Pill>}
                </div>
                <p className="text-sm text-ink-400">
                  {m === "dramatized"
                    ? "Pre-seeded case. Deterministic path. Never fails."
                    : "Fresh case. Live Claude inference. Variable latency."}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Script picker (dramatized only) */}
        {mode === "dramatized" && (
          <>
            <Divider />
            <div>
              <p className="font-mono text-2xs uppercase tracking-widest text-ink-400 mb-3">
                Script
              </p>
              <div className="space-y-2">
                {scripts.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedScript(s.name)}
                    className={cn(
                      "w-full p-3 text-left border transition-all",
                      selectedScript === s.name
                        ? "border-ink-500 bg-ink-800"
                        : "border-ink-700/60 bg-ink-900/30 hover:bg-ink-800/50",
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-sm text-ink-200">{s.name}</span>
                      <span className="font-mono text-2xs text-ink-500">
                        {s.steps.length} steps
                      </span>
                    </div>
                    <p className="text-xs text-ink-400 line-clamp-2">{s.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Speed */}
            <div>
              <p className="font-mono text-2xs uppercase tracking-widest text-ink-400 mb-3">
                Speed
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: 1, label: "Realtime" },
                  { v: 0.5, label: "2× Fast" },
                  { v: 0.25, label: "4× Fast" },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => setSpeed(opt.v)}
                    className={cn(
                      "py-2 font-mono text-2xs uppercase tracking-widest border transition-all",
                      speed === opt.v
                        ? "bg-ink-800 border-ink-500 text-ink-100"
                        : "bg-ink-900/40 border-ink-700 text-ink-400 hover:border-ink-600",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target WhatsApp number (optional) */}
            <div>
              <p className="font-mono text-2xs uppercase tracking-widest text-ink-400 mb-3">
                Target WhatsApp <span className="text-ink-500">· optional</span>
              </p>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={targetWhatsapp}
                onChange={(e) => setTargetWhatsapp(e.target.value)}
                placeholder="+971 50 123 4567"
                className="w-full px-3 py-2 bg-ink-900/40 border border-ink-700 focus:border-amber-500 focus:outline-none text-ink-100 font-mono text-sm placeholder:text-ink-600 tabular-nums transition-colors"
              />
              <p className="font-mono text-2xs text-ink-500 mt-2 leading-relaxed">
                Leave blank for in-UI only. Fill with a Meta-whitelisted number
                to fire real WhatsApps during the demo.
              </p>
            </div>
          </>
        )}

        {mode === "real" && (
          <div className="p-4 border border-signal-hold/30 bg-signal-hold/5">
            <p className="font-mono text-2xs uppercase tracking-widest text-signal-hold mb-1">
              Real mode requires env var
            </p>
            <p className="text-sm text-ink-300">
              Make sure <code className="font-mono text-amber-400">ANTHROPIC_API_KEY</code> is set on
              the Supabase project before launching. Otherwise compliance-evaluate returns 500.
            </p>
          </div>
        )}

        <Button
          variant="primary"
          onClick={launch}
          disabled={launching || (mode === "dramatized" && !selectedScript)}
          className="w-full"
        >
          {launching ? "Launching…" : mode === "dramatized" ? "Run demo" : "Start real case"}
          <span>→</span>
        </Button>
      </div>
    </Panel>
  );
}
