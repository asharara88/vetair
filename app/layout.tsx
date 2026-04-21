import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vetair — Autonomous Pet Relocation",
  description:
    "End-to-end autonomous pet relocation. A polyphonic multi-agent system with three-voice compliance consensus.",
  metadataBase: new URL("https://vetair.vercel.app"),
  openGraph: {
    title: "Vetair",
    description: "Autonomous pet relocation, without human operators.",
    type: "website",
  },
  themeColor: "#07090c",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
