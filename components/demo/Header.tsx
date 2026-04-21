"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LOGO_DARK } from "@/lib/supabase";
import { Pill } from "@/components/ui/primitives";

export function Header() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "UTC",
        }) + " UTC",
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="border-b border-ink-700/60 bg-ink-950/80 backdrop-blur-sm">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src={LOGO_DARK}
            alt="Vetair"
            width={24}
            height={24}
            priority
            className="opacity-90 group-hover:opacity-100 transition-opacity"
          />
          <div className="flex items-baseline gap-3">
            <span className="font-display text-lg tracking-tight text-ink-100">Vetair</span>
            <span className="font-mono text-2xs uppercase tracking-widest text-ink-500">
              Control
            </span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-4">
          <Pill tone="go" dot>System Live</Pill>
          <span className="font-mono text-2xs text-ink-400 tabular-nums">{time}</span>
          <span className="font-mono text-2xs uppercase tracking-widest text-ink-500">
            AE → GB corridor
          </span>
        </div>
      </div>
    </header>
  );
}
