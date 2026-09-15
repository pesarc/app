// Display helpers for the Markets surface: overlay live on-chain data onto the
// catalog and derive the numbers cards/sheets show.

import { prices, totalPool, type Market } from "@pesarc/sdk/markets";
import { type LiveMarket } from "@pesarc/sdk/markets.live";

export type Side = "yes" | "no";

/** Live odds/pools for a catalog entry, keyed by its index (deploy seeds
 *  markets in catalog order). */
export function overlay(
  live: LiveMarket[] | null,
  index: number
): LiveMarket | undefined {
  if (!live) return undefined;
  return live.find((m) => m.id === index);
}

export function displayPrices(
  m: Market,
  live?: LiveMarket
): { yes: number; no: number } {
  if (live) {
    const yes = Math.round(live.impliedYes * 100);
    return { yes, no: 100 - yes };
  }
  return prices(m);
}

export function displayPool(m: Market, live?: LiveMarket): number {
  if (live) return live.poolYes + live.poolNo;
  return totalPool(m);
}
