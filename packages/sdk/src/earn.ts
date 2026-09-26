// Mock corridor pools for the Earn flow. LP yield comes from corridor swap
// fees + FX spread + optional incentives — never interest on held balances
// (PRD §6.2 / §5.2). Figures are illustrative.

export type Venue = "Corridor pool" | "Aave" | "Mento";

export type Pool = {
  id: string;
  corridor: string;
  flags: string;
  venue: Venue;
  baseFeeApy: number; // swap fee share
  fxSpreadApy: number; // dynamic FX spread
  incentiveApy: number; // optional GGARD incentives
  tvlUsd: number;
  risk: "Low" | "Medium";
  // For Basic-tier one-tap wrappers:
  tier: "save" | "invest" | "advanced";
  /** True for a corridor that is live on-chain today (TVL read on-chain).
   *  Others are illustrative targets for corridors launching soon. */
  live?: boolean;
};

export const POOLS: Pool[] = [
  {
    // The one corridor live on-chain now: USD (token0) <-> NGN (token1) hub
    // pool. Its TVL is overlaid from the chain in the Earn UI.
    id: "usd-ngn-hub",
    corridor: "USD ↔ NGN",
    flags: "🇺🇸🇳🇬",
    venue: "Corridor pool",
    baseFeeApy: 3.3,
    fxSpreadApy: 4.5,
    incentiveApy: 1.5,
    tvlUsd: 0,
    risk: "Medium",
    tier: "invest",
    live: true,
  },
  {
    id: "usdc-stable",
    corridor: "USDC stable reserve",
    flags: "💵",
    venue: "Aave",
    baseFeeApy: 3.1,
    fxSpreadApy: 0,
    incentiveApy: 1.0,
    tvlUsd: 8_400_000,
    risk: "Low",
    tier: "save",
  },
  {
    id: "gbp-ngn",
    corridor: "GBP ↔ NGN",
    flags: "🇬🇧🇳🇬",
    venue: "Corridor pool",
    baseFeeApy: 3.2,
    fxSpreadApy: 4.8,
    incentiveApy: 2.0,
    tvlUsd: 2_100_000,
    risk: "Medium",
    tier: "invest",
  },
  {
    id: "usd-kes",
    corridor: "USD ↔ KES",
    flags: "🇺🇸🇰🇪",
    venue: "Corridor pool",
    baseFeeApy: 3.0,
    fxSpreadApy: 4.1,
    incentiveApy: 1.4,
    tvlUsd: 1_350_000,
    risk: "Medium",
    tier: "advanced",
  },
  {
    id: "eur-ghs",
    corridor: "EUR ↔ GHS",
    flags: "🇪🇺🇬🇭",
    venue: "Mento",
    baseFeeApy: 3.4,
    fxSpreadApy: 4.6,
    incentiveApy: 1.2,
    tvlUsd: 720_000,
    risk: "Medium",
    tier: "advanced",
  },
];

export function poolApy(p: Pool): number {
  return +(p.baseFeeApy + p.fxSpreadApy + p.incentiveApy).toFixed(1);
}

export function findPool(id: string): Pool | undefined {
  return POOLS.find((p) => p.id === id);
}
