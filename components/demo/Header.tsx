"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOGO_DARK } from "@/lib/supabase";
import { Pill } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/theater", label: "Case Theater" },
  { href: "/factory", label: "Factory" },
  { href: "/architecture", label: "Architecture" },
];

export function Header() {
  const [time, setTime] = useState<string>("");
  const pathname = usePathname();

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-GB", {
          hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC",
        }) + " UTC",
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="border-b border-ink-700/60 bg-ink-950/80 backdrop-blur-sm sticky top-0 z-20">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-3 group flex-shrink-0">
          <Image src={LOGO_DARK} alt="Vetair" width={24} height={24} priority className="opacity-90 group-hover:opacity-100 transition-opacity" />
          <span className="font-display text-lg tracking-tight text-ink-100">Vetair</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-1 font-mono text-2xs uppercase tracking-widest transition-colors",
                  active ? "text-amber-400" : "text-ink-400 hover:text-ink-100",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:flex items-center gap-4 flex-shrink-0">
          <Pill tone="go" dot>MAS Live</Pill>
          <span className="font-mono text-2xs text-ink-400 tabular-nums">{time}</span>
        </div>
      </div>
    </header>
  );
}
