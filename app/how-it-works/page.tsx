import { Header } from "@/components/demo/Header";
import { Panel, Pill } from "@/components/ui/primitives";
import Link from "next/link";

export const metadata = { title: "How it works · Vetair" };

const STEPS = [
  {
    num: "01",
    title: "Tell us about your pet",
    body:
      "Send us a WhatsApp message with your pet's name, breed, age, microchip number, where you're flying from, and where you're flying to. That's enough for us to start.",
    weHandle: ["WhatsApp intake conversation", "Capturing pet + route + target date"],
    youHandle: ["Microchip number", "Photo of pet's passport / vaccine record"],
  },
  {
    num: "02",
    title: "We check the rules for your route",
    body:
      "Within minutes our compliance agents look up the requirements for your destination country: vaccinations, health certificates, breed restrictions, quarantine windows, age minimums, paperwork timing.",
    weHandle: ["Country import rules", "Breed restrictions", "Vaccine windows", "Required document list"],
    youHandle: ["Confirming dates work for you"],
  },
  {
    num: "03",
    title: "We coordinate the vets and paperwork",
    body:
      "We book your appointments at partner clinics in the right order — rabies titer test, microchip verification, USDA/MOCCAE endorsement. We send you exactly when, where, and what to bring.",
    weHandle: ["Vet appointments", "Government endorsements", "Document validation"],
    youHandle: ["Showing up to the vet visits"],
  },
  {
    num: "04",
    title: "Your pet flies",
    body:
      "We book IATA-approved cargo on a route that meets your pet's species and breed restrictions. Crate sized correctly. Day-of tracking.",
    weHandle: ["Airline cargo booking", "IATA crate sizing", "Day-of tracking"],
    youHandle: ["Drop-off and pickup"],
  },
];

const CORRIDORS = [
  { from: "🇦🇪 UAE", to: "🇬🇧 UK",  status: "live" as const, species: "dog, cat, ferret" },
  { from: "🇬🇧 UK",  to: "🇦🇪 UAE", status: "live" as const, species: "dog, cat" },
  { from: "🇦🇪 UAE", to: "🇫🇷 EU",  status: "soon" as const, species: "dog, cat" },
  { from: "🇦🇪 UAE", to: "🇸🇬 SG",  status: "soon" as const, species: "dog, cat" },
  { from: "🇦🇪 UAE", to: "🇯🇵 JP",  status: "soon" as const, species: "dog, cat" },
  { from: "🇦🇪 UAE", to: "🇺🇸 US",  status: "soon" as const, species: "dog, cat" },
];

export default function HowItWorks() {
  return (
    <>
      <Header />
      <main className="max-w-[900px] mx-auto px-6 py-12 md:py-16">
        <section className="mb-12">
          <p className="font-mono text-2xs uppercase tracking-widest text-brand-500 mb-3">
            How it works
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold leading-[1.1] tracking-tight text-ink-100">
            Four steps, plain English.
          </h1>
          <p className="text-lg text-ink-300 mt-5 leading-relaxed">
            Most pet relocation services hand you a 30-page checklist and disappear.
            We do the work. AI agents handle the parts that are pure rules-and-paperwork
            — country regulations, breed restrictions, document timing — and our human
            partners handle the parts that need hands.
          </p>
        </section>

        {/* Steps */}
        <section className="mb-12 space-y-px bg-ink-700/60 border border-ink-700/60">
          {STEPS.map((step) => (
            <div key={step.num} className="bg-[var(--bg)] p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-[80px_1fr] gap-4">
                <div className="font-mono text-2xs uppercase tracking-widest text-brand-500">
                  {step.num}
                </div>
                <div>
                  <h2 className="text-xl font-medium text-ink-100 leading-snug">
                    {step.title}
                  </h2>
                  <p className="text-ink-300 mt-3 leading-relaxed">{step.body}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div>
                      <p className="font-mono text-2xs uppercase tracking-widest text-ink-400 mb-2">
                        We handle
                      </p>
                      <ul className="space-y-1.5">
                        {step.weHandle.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-sm text-ink-200">
                            <span className="text-brand-500 flex-shrink-0">✓</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-mono text-2xs uppercase tracking-widest text-ink-400 mb-2">
                        You handle
                      </p>
                      <ul className="space-y-1.5">
                        {step.youHandle.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-sm text-ink-200">
                            <span className="text-ink-500 flex-shrink-0">·</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Corridors */}
        <section className="mb-12">
          <h2 className="text-xl font-medium text-ink-100 mb-4">Where we fly to</h2>
          <p className="text-ink-300 mb-5 leading-relaxed">
            We&apos;re live on the UAE ↔ UK corridor. Other corridors are in active
            build — agents already cover the regulatory rules, but real bookings
            still need partner clinics on both ends.
          </p>
          <div className="border border-ink-700/60 divide-y divide-ink-700/40">
            {CORRIDORS.map((c, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-ink-800/20 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-ink-100">
                    {c.from} <span className="text-ink-500">→</span> {c.to}
                  </span>
                  <span className="font-mono text-2xs uppercase tracking-widest text-ink-500">
                    {c.species}
                  </span>
                </div>
                <Pill tone={c.status === "live" ? "go" : "neutral"} dot={c.status === "live"}>
                  {c.status}
                </Pill>
              </div>
            ))}
          </div>
        </section>

        {/* Why agents */}
        <section className="mb-12">
          <Panel eyebrow="Why agents" title="Why is this run by AI?">
            <div className="space-y-4 text-ink-300 leading-relaxed">
              <p>
                Pet relocation is overwhelmingly about applying rules consistently —
                vaccine windows, microchip standards, breed bans, paperwork sequences.
                Humans are bad at this; we miss things, transpose dates, and forget
                that France updated their rules last quarter.
              </p>
              <p>
                <span className="text-ink-100 font-medium">Agents are good at this.</span>{" "}
                Every decision they make cites a specific country rule. An auditor
                agent independently re-checks every verdict and can dissent. If two
                agents disagree, a human reviews — but in 95+ runs so far, that&apos;s
                been the rare exception.
              </p>
              <p>
                Most of what we do is <span className="text-ink-100">cheaper, faster, more accurate</span>{" "}
                than a human relocation specialist would be. The few things that need
                hands — the actual vet visits, the actual flight — we partner for.
              </p>
            </div>
          </Panel>
        </section>

        {/* CTA */}
        <section className="text-center py-8">
          <p className="text-ink-300 mb-5">Ready to see it work?</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/cases"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-white font-mono text-2xs uppercase tracking-widest transition-colors inset-glow"
            >
              ▶ Watch live cases
            </Link>
            <Link
              href="/architecture"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-ink-700 hover:border-ink-500 text-ink-200 hover:text-ink-100 font-mono text-2xs uppercase tracking-widest transition-colors"
            >
              See the agent system →
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
