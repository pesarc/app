// Central site config — drives metadata, nav, and shared copy.
// Product content sourced from the StableArc Unified Product PRD v1.4.

export const site = {
  name: "StableArc",
  tagline: "Send money home in under a minute.",
  description:
    "StableArc is one gasless app to send, hold, earn, and settle money across borders. No seed phrase, no gas tokens, no crypto jargon — money the way you already think about it.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://stablearc.app",
  ogImage: "/og.png",
  keywords: [
    "stablecoin payments",
    "cross-border payments",
    "remittance app",
    "send money to Nigeria",
    "USDC transfers",
    "gasless wallet",
    "mobile money",
    "cross-border settlement",
    "stablecoin remittance",
    "send money home",
  ],
  protocolVersion: "Protocol v1.0",
  nav: [
    { label: "Modes", href: "/#modes" },
    { label: "Corridors", href: "/#corridor" },
    { label: "Rails", href: "/#rails" },
  ],
  appNav: [
    { label: "Home", href: "/home" },
    { label: "Send", href: "/send" },
    { label: "Pay", href: "/pay" },
    { label: "Markets", href: "/markets" },
    { label: "Local", href: "/corridor" },
    { label: "Agent", href: "/agent" },
    { label: "Earn", href: "/earn" },
    { label: "Business", href: "/business" },
  ],
} as const;

export type Site = typeof site;
