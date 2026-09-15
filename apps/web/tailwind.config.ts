import type { Config } from "tailwindcss";

// Pesarc — Relief design system (light, friendly consumer fintech) + shadcn/ui.
// Relief tokens (cream/harbor/sky/ink/slate/fog) drive bespoke screens; the
// shadcn tokens (background/foreground/primary/card/muted/accent/sidebar…) are
// CSS-variable backed (see globals.css) and drive the shadcn component layer.
const config: Config = {
  darkMode: ["class"],
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
        // --- Relief palette (bespoke screens) ---
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
        // legacy aliases (kept for un-migrated marketing landing)
        cloud: "#f9f7f0",
        deepink: "#333333",
        gold: "#13426f",
        emerald: { DEFAULT: "#2e96ff", 600: "#0254a5", 50: "#bde1f9" },
        success: "#0254a5",
        alert: "#c0392b",

        // --- shadcn/ui tokens (CSS-variable backed) ---
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        // Relief scale
        card: "22px",
        "card-lg": "30px",
        field: "16px",
        pill: "9999px",
        btn: "40px",
        // shadcn scale (var-driven)
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        soft: "rgba(0,0,0,0.05) 0px 3px 0px 0px",
        "soft-lg": "rgba(154,207,246,0.5) 0px 5px 0px 0px",
        pop: "rgba(154,207,246,0.5) 0px 7px 0px 0px",
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
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "fade-in": "fadeIn 1.2s ease-out forwards",
        flow: "flow 1s linear infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
