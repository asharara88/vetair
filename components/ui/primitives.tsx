import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

export function Panel({
  title,
  eyebrow,
  children,
  className,
  ...rest
}: { title?: ReactNode; eyebrow?: ReactNode; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("panel rounded-none relative", className)} {...rest}>
      {(title || eyebrow) && (
        <div className="flex items-baseline justify-between gap-4 px-5 py-3 border-b border-ink-700/60">
          {eyebrow && (
            <span className="font-mono text-2xs uppercase tracking-widest text-ink-400">
              {eyebrow}
            </span>
          )}
          {title && <span className="font-display text-ink-100">{title}</span>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

type PillTone = "neutral" | "go" | "hold" | "stop" | "ping" | "amber";

const TONE: Record<PillTone, string> = {
  neutral: "bg-ink-800 text-ink-300 border-ink-700",
  go:      "bg-signal-go/10 text-signal-go border-signal-go/30",
  hold:    "bg-signal-hold/10 text-signal-hold border-signal-hold/30",
  stop:    "bg-signal-stop/10 text-signal-stop border-signal-stop/30",
  ping:    "bg-signal-ping/10 text-signal-ping border-signal-ping/30",
  amber:   "bg-amber-500/10 text-amber-400 border-amber-500/30",
};

export function Pill({
  tone = "neutral",
  children,
  dot = false,
  className,
}: {
  tone?: PillTone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none border font-mono text-2xs uppercase tracking-widest",
        TONE[tone],
        className,
      )}
    >
      {dot && <span className="signal-dot" style={{ color: "currentColor" }} />}
      {children}
    </span>
  );
}

export function Button({
  variant = "primary",
  children,
  className,
  ...rest
}: {
  variant?: "primary" | "secondary" | "ghost";
  children: ReactNode;
  className?: string;
} & Omit<HTMLAttributes<HTMLButtonElement>, "children">) {
  const base = "inline-flex items-center justify-center gap-2 px-4 py-2 font-mono text-2xs uppercase tracking-widest transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-amber-500 text-ink-950 hover:bg-amber-400 inset-glow",
    secondary: "bg-ink-800 text-ink-100 border border-ink-700 hover:bg-ink-700 hover:border-ink-600",
    ghost: "text-ink-300 hover:text-ink-100 hover:bg-ink-800",
  } as const;
  return <button className={cn(base, variants[variant], className)} {...rest}>{children}</button>;
}

export function Divider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 h-px bg-ink-700/60" />
      {label && <span className="font-mono text-2xs uppercase tracking-widest text-ink-500">{label}</span>}
      <div className="flex-1 h-px bg-ink-700/60" />
    </div>
  );
}
