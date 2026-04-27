import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vetair — A polyphonic multi-agent system for pet relocation",
  description:
    "Pet relocation run by agents. An Orchestrator routes cases through Intake, Compliance, and Auditor voices that reason against each other. Every customer-facing claim cites a regulatory requirement code.",
  metadataBase: new URL("https://vetair.vercel.app"),
  openGraph: {
    title: "Vetair — Polyphonic MAS",
    description:
      "Three independent compliance voices reach consensus. Specialist agents negotiate a feasible timeline. The full itinerary is delivered to the owner on WhatsApp. Zero human touchpoints.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Vetair — Polyphonic MAS",
    description:
      "Three voices reach consensus. Specialist agents negotiate a feasible timeline. Zero human touchpoints.",
  },
};

export const viewport: Viewport = {
  themeColor: "#07090c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
