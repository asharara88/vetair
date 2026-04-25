import Link from "next/link";
import { Panel, Pill } from "@/components/ui/primitives";

export function ComingSoon({
  eyebrow, title, session, description, willShow,
}: {
  eyebrow: string; title: string; session: string; description: string; willShow: string[];
}) {
  return (
    <main className="max-w-[1400px] mx-auto px-6 py-16">
      <div className="max-w-2xl">
        <p className="font-mono text-2xs uppercase tracking-widest text-amber-400 mb-6">{eyebrow}</p>
        <h1 className="font-display text-5xl leading-[1.1] text-ink-100 tracking-tight">{title}</h1>
        <div className="flex items-center gap-2 mt-6">
          <Pill tone="amber">Coming in {session}</Pill>
          <Pill tone="neutral">Build in progress</Pill>
        </div>
        <p className="text-lg text-ink-300 mt-8 leading-relaxed">{description}</p>

        <Panel eyebrow="Will show" title="What this page delivers" className="mt-10">
          <ul className="space-y-3 text-sm text-ink-300 leading-relaxed">
            {willShow.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="font-mono text-2xs text-amber-400 tabular-nums flex-shrink-0 mt-0.5">
                  0{i + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="mt-10">
          <Link href="/" className="font-mono text-2xs uppercase tracking-widest text-ink-400 hover:text-amber-400 transition-colors">
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
