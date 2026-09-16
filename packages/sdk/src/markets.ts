// Mock catalog for the Markets (FX / macro hedge) surface. Each entry mirrors
// the on-chain PredictionMarket (parimutuel, local-currency collateral) so the
// UI reads real once wired. Figures are illustrative.
//
// The wedge: collateral is the LOCAL currency (cNGN / cKES), not USDC — so the
// stake, the payout, and the thing being hedged are the same money. A naira
// holder who is long the "USD/NGN goes up" side is *hedged* against their own
// currency sliding, settled from Pesarc's own realized FX rate. No dollar in
// the path, no external feed to deny or compel.

export type MarketKind = "fx" | "macro" | "sports" | "politics";

/** How a market resolves — pinned at creation, mirrors PredictionMarket.Source. */
export type Resolver =
  | { kind: "oracle"; feed: string } // RealizedRateOracle TWAP
  | { kind: "attested"; attestor: string }; // bonded attestor + dispute window

/** One choice in a multi-outcome market, with its parimutuel pool. */
export type Outcome = { label: string; pool: number };

export type Market = {
  id: string;
  kind: MarketKind;
  question: string;
  /** Local-currency collateral symbol (the edge). */
  collateral: "cNGN" | "cKES" | "cGHS";
  flag: string;
  /** Parimutuel pools, in whole collateral units. */
  poolYes: number;
  poolNo: number;
  closes: string; // human close date
  resolves: string; // human resolve date
  resolver: Resolver;
  /** True FX/macro markets that double as a hedge get the shield framing. */
  hedge: boolean;
  /** One-line "why this is a hedge, not a bet" for the card. */
  hedgeNote?: string;
  /** "binary" (Yes/No, default) or "multi" (2–8 named outcomes). */
  type?: "binary" | "multi";
  /** Present for multi markets — the choices and their pools. */
  outcomes?: Outcome[];
  /** Community-proposed markets carry the proposer + a "proposed" status. */
  proposer?: string;
  status?: "live" | "proposed";
};

/** True when the market has named multi-outcome choices. */
export function isMulti(m: Market): boolean {
  return m.type === "multi" && Array.isArray(m.outcomes) && m.outcomes.length >= 2;
}

/** Implied probability (%) for each multi outcome, from the parimutuel pools. */
export function outcomePrices(m: Market): number[] {
  const outs = m.outcomes ?? [];
  const total = outs.reduce((s, o) => s + o.pool, 0);
  if (total === 0) return outs.map(() => Math.round(100 / Math.max(1, outs.length)));
  return outs.map((o) => Math.round((o.pool / total) * 100));
}

/** Total liquidity across a multi market's outcomes. */
export function multiTotalPool(m: Market): number {
  return (m.outcomes ?? []).reduce((s, o) => s + o.pool, 0);
}

export const MARKETS: Market[] = [
  {
    id: "usdngn-dec",
    kind: "fx",
    question: "USD/NGN monthly close ≥ ₦1,600 on Dec 31?",
    collateral: "cNGN",
    flag: "🇳🇬",
    poolYes: 6_200_000,
    poolNo: 3_800_000,
    closes: "Dec 28",
    resolves: "Dec 31",
    resolver: { kind: "oracle", feed: "RealizedRateOracle · USD/NGN TWAP" },
    hedge: true,
    hedgeNote: "If the naira slides, this pays out to offset it.",
  },
  {
    id: "pms-dec",
    kind: "macro",
    question: "PMS pump price ≥ ₦1,000/litre in December?",
    collateral: "cNGN",
    flag: "⛽",
    poolYes: 2_100_000,
    poolNo: 1_450_000,
    closes: "Dec 20",
    resolves: "Jan 3",
    resolver: { kind: "attested", attestor: "NMDPRA / NNPC · bonded + dispute" },
    hedge: true,
    hedgeNote: "Fuel-cost cover for drivers and logistics businesses.",
  },
  {
    id: "cpi-dec",
    kind: "macro",
    question: "Nigeria CPI inflation stays under 30% (Dec print)?",
    collateral: "cNGN",
    flag: "📈",
    poolYes: 1_300_000,
    poolNo: 2_700_000,
    closes: "Jan 10",
    resolves: "Jan 15",
    resolver: { kind: "attested", attestor: "NBS · bonded + dispute" },
    hedge: true,
    hedgeNote: "Inflation cover, settled in the currency it erodes.",
  },
  {
    id: "afcon-final",
    kind: "sports",
    question: "Nigeria reach the AFCON final?",
    collateral: "cNGN",
    flag: "⚽",
    poolYes: 900_000,
    poolNo: 1_600_000,
    closes: "Jan 18",
    resolves: "Feb 1",
    resolver: { kind: "attested", attestor: "CAF result · bonded + dispute" },
    hedge: false,
  },
];

/** Parimutuel implied YES probability, 0–1, from the pools. */
export function impliedYes(m: Market): number {
  const total = m.poolYes + m.poolNo;
  if (total === 0) return 0.5;
  return m.poolYes / total;
}

/** Price in cents a card shows for each side (implied odds). */
export function prices(m: Market): { yes: number; no: number } {
  const y = impliedYes(m);
  return { yes: Math.round(y * 100), no: Math.round((1 - y) * 100) };
}

/** Total pool in whole collateral units, for the liquidity line. */
export function totalPool(m: Market): number {
  return m.poolYes + m.poolNo;
}

export const MARKET_CATEGORIES: { value: MarketKind | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "fx", label: "FX" },
  { value: "macro", label: "Macro" },
  { value: "sports", label: "Sports" },
  { value: "politics", label: "Politics" },
];
