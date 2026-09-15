import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      colors: {
        // Pesarc brand — marketing landing (dark). Emerald = signal/state,
        // gold = value/CTA. Orange retired (2026).
        ink: "#06080b",
        accent: {
          DEFAULT: "#35E39C", // emerald signal (dark theme)
          600: "#2BC889", // hover/pressed
        },
        // Consumer app palette (light). The `emerald` token now carries the
        // real emerald green the whole app references; `gold` is the value/CTA.
        emerald: {
          DEFAULT: "#0F8A6B", // app emerald — readable on light
          600: "#0C7357", // hover/pressed
          50: "#E7F5F0", // emerald tint surfaces
        },
        cloud: "#F6F8F7", // app ground (light twin of the dark landing)
        deepink: "#11241F", // ink text (deep emerald-black)
        gold: "#E0A82E", // value / CTA
        success: "#1F9D57",
        alert: "#D2452B",
        muted: "#6B7B76", // cool zinc
      },
      borderRadius: {
        card: "20px",
        field: "16px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(24,24,27,0.04), 0 8px 24px -8px rgba(24,24,27,0.12)",
        "soft-lg":
          "0 2px 4px rgba(24,24,27,0.05), 0 18px 40px -12px rgba(24,24,27,0.18)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        flow: {
          "0%": { strokeDashoffset: "20" },
          "100%": { strokeDashoffset: "0" },
        },
        gradientShift: {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
      },
      animation: {
        "fade-in": "fadeIn 1.2s ease-out forwards",
        flow: "flow 1s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
