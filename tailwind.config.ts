import type { Config } from "tailwindcss";

const config: Config = {
  // Class-based dark mode so we can support light/dark via data-theme attribute
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ─────────────────────────────────────────────────────────────────
        // Ink — neutral palette, kept from previous design.
        // Used across both light and dark themes via CSS variables in globals.
        // ─────────────────────────────────────────────────────────────────
        ink: {
          950: "#07090c",
          900: "#0d1117",
          800: "#151b24",
          700: "#1f2733",
          600: "#2a3441",
          500: "#3a4553",
          400: "#5b6779",
          300: "#8b95a6",
          200: "#c5ccd6",
          100: "#e8ecf2",
          50:  "#f5f7fa",
        },

        // ─────────────────────────────────────────────────────────────────
        // Signal — semantic state colors, kept.
        // ─────────────────────────────────────────────────────────────────
        signal: {
          go:    "#34d399",
          hold:  "#fbbf24",
          stop:  "#f87171",
          ping:  "#60a5fa",
        },

        // ─────────────────────────────────────────────────────────────────
        // Brand — Vetair orange #fe4b2d (sampled from logo).
        // Replaces the previous "aviation amber" entirely.
        // ─────────────────────────────────────────────────────────────────
        brand: {
          50:  "#fff5f2",
          100: "#ffe7e0",
          200: "#ffc8b8",
          300: "#ffa288",
          400: "#ff7a59",
          500: "#fe4b2d",   // ← primary brand color
          600: "#e63a1d",
          700: "#bf2e16",
          800: "#8f2210",
          900: "#5e1709",
        },

        // ─────────────────────────────────────────────────────────────────
        // Compatibility shim — the existing demo/* components still reference
        // text-amber-400, bg-amber-500/10, etc. Map those directly to brand
        // so no demo component breaks during the switch.
        // ─────────────────────────────────────────────────────────────────
        amber: {
          400: "#ff7a59",   // was #fbbe4c → now brand-400
          500: "#fe4b2d",   // was #f5a623 → now brand-500
          600: "#e63a1d",   // was #d48809 → now brand-600
        },
      },

      fontFamily: {
        // Inter for everything sans, JetBrains Mono for data readouts.
        // Display serif retired — the new design doesn't use it.
        sans:    ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono:    ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },

      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.04em" }],
      },

      letterSpacing: {
        widest: "0.2em",
      },

      animation: {
        "pulse-ping": "pulse-ping 2.5s ease-in-out infinite",
        "slide-up":   "slide-up 0.32s ease-out",
        "fade-in":    "fade-in 0.24s ease-out",
        "shimmer":    "shimmer 2.4s linear infinite",
      },
      keyframes: {
        "pulse-ping": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.55" },
        },
        "slide-up": {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
