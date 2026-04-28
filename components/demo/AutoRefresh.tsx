"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Polls server components by calling router.refresh() every intervalMs.
 * Renders a small "Live" indicator that pulses on each refresh tick.
 * Pauses when the tab is not visible, to avoid background load.
 */
export function AutoRefresh({ intervalMs = 5000, label = "Live" }: { intervalMs?: number; label?: string }) {
  const router = useRouter();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      router.refresh();
      setTick((t) => t + 1);
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none border font-mono text-2xs uppercase tracking-widest bg-signal-go/10 text-signal-go border-signal-go/30">
      <span
        key={tick}
        className="signal-dot animate-pulse"
        style={{ color: "currentColor" }}
      />
      {label}
    </span>
  );
}
