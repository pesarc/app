// Central site config — drives metadata, nav, and shared copy.
// Product content sourced from the Pesarc Unified Product PRD v1.4.

export const site = {
  name: "Pesarc",
  tagline: "Send money home in seconds.",
  description:
    "Pesarc is one simple app to send, hold, earn and settle money across borders, in your own currency. No big fees, no waiting, no jargon, just money the way you already think about it.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://pesarc.xyz",
  // The dashboard lives on its own host in production (app.pesarc.xyz) while the
  // landing lives on the apex. Set NEXT_PUBLIC_APP_URL to that origin so the
  // landing's "Open app" CTA crosses to it; unset (dev) → relative same-origin.
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "",
  ogImage: "/og.png",
  keywords: [
    "send money to Africa",
    "cross-border payments",
    "remittance app",
    "send money to Nigeria",
    "mobile money transfer",
    "local currency wallet",
    "pay bills Nigeria",
    "money app Africa",
    "cheap international transfer",
    "earn and invest Africa",
  ],
  protocolVersion: "Protocol v1.0",
  nav: [
    { label: "Product", href: "/#features" },
    { label: "Networks", href: "/#networks" },
    { label: "Beta", href: "/#beta" },
  ],
  appNav: [
    { label: "Home", href: "/home" },
    { label: "Send", href: "/send" },
    { label: "Pay", href: "/pay" },
    { label: "Agent", href: "/agent" },
    { label: "Markets", href: "/markets" },
    { label: "Earn", href: "/earn" },
    { label: "Local", href: "/corridor" },
    { label: "Business", href: "/business" },
  ],
} as const;

export type Site = typeof site;
