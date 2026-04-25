"use client";
import { useEffect, useRef } from "react";
import type { CommsMessage } from "@/types/database";
import { cn, formatTime } from "@/lib/utils";
import { Panel } from "@/components/ui/primitives";

export function WhatsAppPanel({ messages }: { messages: CommsMessage[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  return (
    <Panel eyebrow="04 · Owner Comms · WhatsApp" title="Thread">
      <div
        ref={scrollRef}
        className="max-h-[520px] overflow-y-auto space-y-2.5 pr-2"
        style={{
          backgroundImage:
            "radial-gradient(rgba(139,149,166,0.04) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      >
        {messages.length === 0 && (
          <p className="font-mono text-2xs uppercase tracking-widest text-ink-500 py-8 text-center">
            No messages yet
          </p>
        )}
        {messages.map((m) => {
          const isInbound = m.direction === "inbound";
          return (
            <div
              key={m.id}
              className={cn("flex animate-slide-up", isInbound ? "justify-start" : "justify-end")}
            >
              <div className={cn("max-w-[85%] flex flex-col", isInbound ? "items-start" : "items-end")}>
                <div
                  className={cn(
                    "px-3.5 py-2.5 text-sm leading-relaxed",
                    isInbound
                      ? "bg-ink-800 text-ink-100 rounded-[2px] rounded-tl-none"
                      : "bg-amber-500/90 text-ink-950 rounded-[2px] rounded-tr-none font-medium",
                  )}
                >
                  <p style={{ whiteSpace: "pre-wrap" }}>{m.body}</p>
                  {m.media_urls && m.media_urls.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.media_urls.map((url, i) => (
                        <span
                          key={i}
                          className={cn(
                            "font-mono text-2xs px-2 py-0.5 border",
                            isInbound
                              ? "border-ink-600 text-ink-400"
                              : "border-ink-950/20 text-ink-950/80",
                          )}
                        >
                          📎 {String(url).split("/").pop()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 px-1">
                  <span className="font-mono text-2xs text-ink-500 tabular-nums">
                    {formatTime(m.created_at)}
                  </span>
                  {m.sent_by_agent && !isInbound && (
                    <span className="font-mono text-2xs text-ink-500">
                      · {m.sent_by_agent.replace("_agent", "")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
