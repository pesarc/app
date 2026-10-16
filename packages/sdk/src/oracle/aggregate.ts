// Multi-oracle aggregator. Resolves one USD->currency rate by gathering every
// available source (Chainlink Data Feeds, Pyth, and an optional off-chain/
// push-oracle seed), taking the MEDIAN, and flagging when sources disagree
// beyond a threshold. Median-and-flag: a single bad feed can't move the result,
// and a disagreement is surfaced (not silently served or blocked).
//
// Everything is in the `usdPer` convention: USD per 1 unit of the currency.
// Drop-in for callers that used chainlinkUsdPer — use aggregateUsdPer / usdPer.

import { chainlinkUsdPer, hasChainlinkFeed } from "./chainlink";
import { pythUsdPer, hasPythFeed } from "./pyth";

/** Disagreement beyond this (basis points vs the median) raises `flagged`. */
export const DEVIATION_FLAG_BPS = 200; // 2%

export type AggQuote = { usdPer: number; source: string };
export type AggResult = {
  usdPer: number;
  /** sources that contributed, e.g. ["chainlink","pyth","api"] */
  sources: string[];
  /** max spread of any source vs the median, in basis points */
  deviationBps: number;
  /** deviationBps > DEVIATION_FLAG_BPS */
  flagged: boolean;
};

export type AggregateOpts = {
  /** An off-chain/API value already in hand (e.g. open.er-api), added as a source. */
  seedUsdPer?: number;
  seedSource?: string;
  /** Skip the on-chain sources (e.g. when only a quick API cross-check is wanted). */
  onchainOnly?: boolean;
};

/** True when at least one on-chain oracle (Chainlink or Pyth) covers this currency. */
export function hasOnchainOracle(currency: string): boolean {
  return hasChainlinkFeed(currency) || hasPythFeed(currency);
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function gather(currency: string, opts?: AggregateOpts): Promise<AggQuote[]> {
  const out: AggQuote[] = [];
  const [cl, py] = await Promise.all([chainlinkUsdPer(currency), pythUsdPer(currency)]);
  if (cl && cl > 0) out.push({ usdPer: cl, source: "chainlink" });
  if (py && py > 0) out.push({ usdPer: py, source: "pyth" });
  if (!opts?.onchainOnly && opts?.seedUsdPer && opts.seedUsdPer > 0) {
    out.push({ usdPer: opts.seedUsdPer, source: opts.seedSource || "api" });
  }
  return out;
}

/**
 * Aggregate every available source into one rate (median) plus a disagreement
 * flag. Returns null when nothing could price the currency.
 */
export async function aggregateUsdPer(
  currency: string,
  opts?: AggregateOpts,
): Promise<AggResult | null> {
  const quotes = await gather(currency, opts);
  if (quotes.length === 0) return null;
  const vals = quotes.map((q) => q.usdPer);
  const med = median(vals);
  const deviationBps = Math.round(
    Math.max(...vals.map((v) => (Math.abs(v - med) / med) * 10_000)),
  );
  return {
    usdPer: med,
    sources: quotes.map((q) => q.source),
    deviationBps,
    flagged: deviationBps > DEVIATION_FLAG_BPS,
  };
}

/** Convenience: just the aggregated usdPer, or null. */
export async function usdPer(currency: string, opts?: AggregateOpts): Promise<number | null> {
  const r = await aggregateUsdPer(currency, opts);
  return r ? r.usdPer : null;
}
