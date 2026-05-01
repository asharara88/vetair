"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";

// Public-facing nav labels — verb-driven, not jargon.
// Prior labels ("Theater", "Factory", "Architecture") were optimized for an
// engineering audience; the new structure leads with what each page DOES
// for a visitor in their first minute.
const NAV: { href: string; label: string; matchPrefix?: string }[] = [
  { href: "/",              label: "Overview" },
  { href: "/how-it-works",  label: "How it works" },
  { href: "/cases",         label: "Live cases", matchPrefix: "/cases" },
  { href: "/architecture",  label: "Architecture" },
  { href: "/factory",       label: "Factory" },
];

function isActive(pathname: string, item: (typeof NAV)[number]): boolean {
  if (item.href === "/") return pathname === "/";
  if (item.matchPrefix) return pathname.startsWith(item.matchPrefix);
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function Header() {
  const pathname = usePathname() ?? "/";
  return (
    <header className="sticky top-0 z-20 border-b border-ink-700/60 bg-[var(--header-bg)] backdrop-blur">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between gap-6">
        {/* Brand + nav */}
        <div className="flex items-center gap-8 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-2.5 flex-shrink-0"
            aria-label="Vetair"
          >
            <span className="relative w-7 h-7 inline-flex items-center justify-center">
              {/* Both logos render; CSS hides the wrong one per active theme */}
              <Image
                src="/vetair-icon-dark.png"
                alt=""
                width={28}
                height={28}
                className="logo-dark object-contain"
                priority
              />
              <Image
                src="/vetair-icon-light.png"
                alt=""
                width={28}
                height={28}
                className="logo-light absolute inset-0 object-contain"
                priority
              />
            </span>
            <span className="font-semibold tracking-tight text-ink-100 text-[15px]">Vetair</span>
          </Link>

          <nav className="hidden md:flex items-center gap-0 h-14" aria-label="Primary">
            {NAV.map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "h-14 px-3 inline-flex items-center text-sm transition-colors border-b-2 -mb-px",
                    active
                      ? "text-ink-100 border-brand-500"
                      : "text-ink-400 hover:text-ink-100 border-transparent",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right cluster: status + theme toggle */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-2xs uppercase tracking-widest text-ink-400 font-mono">
            <span className="signal-dot text-brand-500 animate-pulse-ping" />
            Operational
          </span>
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile nav row */}
      <nav
        className="md:hidden flex items-center gap-0 px-4 h-10 border-t border-ink-700/40 overflow-x-auto"
        aria-label="Primary mobile"
      >
        {NAV.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "h-10 px-3 inline-flex items-center text-xs whitespace-nowrap transition-colors border-b-2",
                active
                  ? "text-ink-100 border-brand-500"
                  : "text-ink-400 border-transparent",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
