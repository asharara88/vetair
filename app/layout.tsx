import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vetair â A self-extending Multi-Agent System",
  description:
    "Pet relocation run by agents. An Orchestrator routes cases through Intake, Compliance, and Auditor agents. A Synthesizer writes new country specialists on demand.",
  metadataBase: new URL("https://vetair.vercel.app"),
  openGraph: {
    title: "Vetair â Self-extending MAS",
    description:
      "An Orchestrator agent routes cases. A Synthesizer writes new specialists at runtime. Every decision cited. Every turn audited.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Vetair â Self-extending MAS",
    description:
      "An Orchestrator agent routes cases. A Synthesizer writes new specialists at runtime.",
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
