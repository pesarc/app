// Central site config — drives metadata, nav, and shared copy.
// Product content sourced from the Pesarc Unified Product PRD v1.4.

export const site = {
  name: "Pesarc",
  tagline: "Predict Africa. Settle in your own money.",
  description:
    "Pesarc is a prediction market for Africa. Take a view on elections, football, prices and the events you already argue about, in your own currency, gasless. Backed by our own on-chain liquidity so there is always a price to trade against.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://pesarc.money",
  // The dashboard lives on its own host in production (app.pesarc.xyz) while the
  // landing lives on the apex. Set NEXT_PUBLIC_APP_URL to that origin so the
  // landing's "Open app" CTA crosses to it; unset (dev) → relative same-origin.
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "",
  ogImage: "/og.png",
  keywords: [
    "prediction market",
    "prediction market Africa",
    "Polymarket Africa",
    "predict elections",
    "football predictions",
    "stablecoin prediction market",
    "bet on events Nigeria",
    "gasless wallet",
    "local currency markets",
    "on-chain liquidity Africa",
  ],
  protocolVersion: "Protocol v1.0",
  nav: [
    { label: "Markets", href: "/#features" },
    { label: "Networks", href: "/#networks" },
    { label: "Beta", href: "/#beta" },
  ],
  appNav: [
    { label: "Home", href: "/home" },
    { label: "Markets", href: "/markets" },
    { label: "Agent", href: "/agent" },
    { label: "Send", href: "/send" },
    { label: "Bridge", href: "/bridge" },
    { label: "Pay", href: "/pay" },
    { label: "Local", href: "/corridor" },
    { label: "Earn", href: "/earn" },
    { label: "Business", href: "/business" },
  ],
} as const;

export type Site = typeof site;
