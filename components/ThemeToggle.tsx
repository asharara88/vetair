"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type ThemePref = "light" | "auto" | "dark";

const OPTIONS: { key: ThemePref; title: string; icon: React.ReactNode }[] = [
  {
    key: "light",
    title: "Light theme",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    ),
  },
  {
    key: "auto",
    title: "Match system",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2" y="4" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 18v3" />
      </svg>
    ),
  },
  {
    key: "dark",
    title: "Dark theme",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ),
  },
];

export default function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>("auto");

  useEffect(() => {
    const stored =
      (document.documentElement.getAttribute("data-theme-pref") as ThemePref | null) ?? "auto";
    setPref(stored);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (document.documentElement.getAttribute("data-theme-pref") === "auto") {
        document.documentElement.setAttribute("data-theme", mq.matches ? "dark" : "light");
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function apply(next: ThemePref) {
    const resolved =
      next === "auto"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : next;
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.setAttribute("data-theme-pref", next);
    try {
      localStorage.setItem("vetair-theme", next);
    } catch {
      /* localStorage unavailable */
    }
    setPref(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center gap-0.5 border border-ink-700 bg-ink-900/40 p-0.5"
    >
      {OPTIONS.map((opt) => {
        const active = pref === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.title}
            title={opt.title}
            onClick={() => apply(opt.key)}
            className={cn(
              "inline-flex items-center justify-center w-7 h-7 transition-colors",
              active
                ? "bg-ink-800 text-ink-100"
                : "text-ink-500 hover:text-ink-200",
            )}
          >
            <span className="block w-3.5 h-3.5">{opt.icon}</span>
          </button>
        );
      })}
    </div>
  );
}
