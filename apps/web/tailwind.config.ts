import type { Config } from "tailwindcss";

// Pesarc — Relief design system (light, friendly consumer fintech).
// Cream canvas, deep-harbor navy blocks, ONE sky-blue accent, flat pop-shadows,
// pill interactive, Manrope. Legacy token names (emerald/gold/cloud/deepink/
// muted) are remapped to Relief values so existing classes adopt the new look;
// prefer the Relief names (sky/harbor/cream/ink/slate/fog) in new work.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      colors: {
        // marketing landing (dark) — accent left usable
        accent: { DEFAULT: "#2e96ff", 600: "#0254a5" },

        // --- Relief palette ---
        cream: "#f9f7f0",
        snow: "#ffffff",
        harbor: "#13426f",
        ink: "#333333",
        charcoal: "#212121",
        slate: "#616c8a",
        fog: "#d0d5dd",
        sky: {
          DEFAULT: "#2e96ff",
          deep: "#0254a5",
          tint: "#bde1f9",
          wash: "#cde7fb",
          mid: "#50a7ff",
        },

        // --- legacy names remapped to Relief ---
        emerald: { DEFAULT: "#2e96ff", 600: "#0254a5", 50: "#bde1f9" }, // → sky
        cloud: "#f9f7f0", // → cream
        deepink: "#333333", // → ink
        gold: "#13426f", // → harbor (navy secondary)
        muted: "#616c8a", // → slate
        success: "#0254a5",
        alert: "#c0392b",
      },
      borderRadius: {
        card: "22px",
        "card-lg": "30px",
        field: "16px",
        pill: "9999px",
        btn: "40px",
      },
      boxShadow: {
        // Relief: flat solid offsets, never blur.
        soft: "rgba(0,0,0,0.05) 0px 3px 0px 0px", // → flat card (legacy alias)
        "soft-lg": "rgba(154,207,246,0.5) 0px 5px 0px 0px", // → pop-sm (legacy alias)
        pop: "rgba(154,207,246,0.5) 0px 7px 0px 0px", // primary CTA lift
        "pop-sm": "rgba(154,207,246,0.5) 0px 5px 0px 0px",
        "card-flat": "rgba(0,0,0,0.05) 0px 3px 0px 0px",
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
