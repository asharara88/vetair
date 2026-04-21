"use client";
import { useEffect, useRef } from "react";
import type { AgentLog } from "@/types/database";
import { agentMeta, formatTime, formatMs, formatCost } from "@/lib/utils";
import { Panel, Pill } from "@/components/ui/primitives";

export function AgentChatter({ logs }: { logs: AgentLog[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [logs.length]);

  return (
    <Panel eyebrow="02 · Agent Log" title={<span>Stream <span className="text-ink-500 font-mono text-sm">· {logs.length}</span></span>}>
      <div ref={scrollRef} className="max-h-[520px] overflow-y-auto space-y-2 pr-2">
        {logs.length === 0 && (
          <p className="font-mono text-2xs uppercase tracking-widest text-ink-500 py-8 text-center">
            Awaiting events…
          </p>
        )}
        {logs.map((log) => {
          const meta = agentMeta(log.agent_name);
          return (
            <div
              key={log.id}
              className="animate-slide-up border-l-2 pl-3 py-2"
              style={{ borderColor: meta.color }}
            >
              <div className="flex items-center gap-3 mb-1">
                <span
                  className="font-mono text-2xs font-semibold tracking-widest"
                  style={{ color: meta.color }}
                >
                  {meta.short}
                </span>
                <span className="font-mono text-sm text-ink-100">{meta.label}</span>
                <span className="font-mono text-2xs text-ink-500 ml-auto tabular-nums">
                  {formatTime(log.created_at)}
                </span>
              </div>
              {log.decision_summary && (
                <p className="text-sm text-ink-300 leading-relaxed pl-0">
                  {log.decision_summary}
                </p>
              )}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {log.model && (
                  <span className="font-mono text-2xs text-ink-500">
                    {log.model.replace("claude-", "").replace("-20250514", "")}
                  </span>
                )}
                {log.latency_ms != null && log.latency_ms > 0 && (
                  <span className="font-mono text-2xs text-ink-500">
                    {formatMs(log.latency_ms)}
                  </span>
                )}
                {log.cost_usd != null && log.cost_usd > 0 && (
                  <span className="font-mono text-2xs text-ink-500">
                    {formatCost(log.cost_usd)}
                  </span>
                )}
                {log.confidence != null && (
                  <Pill tone={log.confidence >= 0.9 ? "go" : log.confidence >= 0.7 ? "hold" : "stop"}>
                    {(log.confidence * 100).toFixed(0)}%
                  </Pill>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
