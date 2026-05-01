import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vetair — Autonomous pet relocation",
  description:
    "Move your pet across borders without the paperwork. AI agents handle compliance, vet bookings, and airline cargo end-to-end.",
  metadataBase: new URL("https://vetair.vercel.app"),
  openGraph: {
    title: "Vetair — Autonomous pet relocation",
    description:
      "AI agents handle compliance, vet bookings, and airline cargo end-to-end. Every decision cited. Every turn audited.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Vetair — Autonomous pet relocation",
    description: "AI agents move your pet across borders, end to end.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)",  color: "#07090c" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

// Inline FOUC-prevention. Reads the persisted theme preference and applies
// data-theme to <html> *before* React hydrates and *before* first paint, so
// users who reload don't see a flash of the wrong theme.
const themeBootScript = `
(function(){
  try {
    var pref = localStorage.getItem('vetair-theme') || 'auto';
    var resolved = pref;
    if (pref === 'auto') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-theme-pref', pref);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('data-theme-pref', 'auto');
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
