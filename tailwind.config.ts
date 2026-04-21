import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Vetair palette — "cold control room"
        ink: {
          950: "#07090c",  // near-black background
          900: "#0d1117",  // panel background
          800: "#151b24",  // elevated panel
          700: "#1f2733",
          600: "#2a3441",
          500: "#3a4553",
          400: "#5b6779",
          300: "#8b95a6",
          200: "#c5ccd6",
          100: "#e8ecf2",
          50:  "#f5f7fa",
        },
        // Signal colors — used sparingly, only for meaningful state
        signal: {
          go:    "#34d399", // approved / satisfied
          hold:  "#fbbf24", // pending / waiting
          stop:  "#f87171", // blocked / error
          ping:  "#60a5fa", // active / communicating
        },
        // Brand accent — "aviation amber"
        amber: {
          400: "#fbbe4c",
          500: "#f5a623",
          600: "#d48809",
        },
      },
      fontFamily: {
        display: ['"Fraunces"', "ui-serif", "Georgia", "serif"],
        sans: ['"Outfit"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.04em" }],
      },
      letterSpacing: {
        widest: "0.2em",
      },
      animation: {
        "pulse-ping": "pulse-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
        "slide-up":   "slide-up 0.32s ease-out",
        "fade-in":    "fade-in 0.24s ease-out",
        "shimmer":    "shimmer 2.4s linear infinite",
      },
      keyframes: {
        "pulse-ping": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%":      { opacity: "0.4", transform: "scale(1.4)" },
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
      backgroundImage: {
        "grid-fade": "linear-gradient(to bottom, rgba(13,17,23,0) 0%, rgba(13,17,23,1) 100%)",
        "grid-lines": `
          linear-gradient(to right, rgba(139,149,166,0.04) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(139,149,166,0.04) 1px, transparent 1px)
        `,
      },
      backgroundSize: {
        "grid": "48px 48px",
      },
    },
  },
  plugins: [],
};

export default config;
