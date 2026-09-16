// Display helpers for the Markets surface: overlay live on-chain data onto the
// catalog and derive the numbers cards/sheets show.

import {
  prices,
  totalPool,
  outcomePrices,
  multiTotalPool,
  isMulti,
  type Market,
} from "@pesarc/sdk/markets";
import { type LiveMarket } from "@pesarc/sdk/markets.live";

export type Side = "yes" | "no";

/** What a stake ticket is backing: a binary side or a multi outcome index. */
export type Selection =
  | { kind: "binary"; side: Side }
  | { kind: "multi"; outcome: number };

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
  if (isMulti(m)) return multiTotalPool(m);
  return totalPool(m);
}

/** Price (¢) for a given selection. */
export function selectionPrice(m: Market, sel: Selection, live?: LiveMarket): number {
  if (sel.kind === "binary") {
    const p = displayPrices(m, live);
    return sel.side === "yes" ? p.yes : p.no;
  }
  return outcomePrices(m)[sel.outcome] ?? 0;
}

/** Human label for a given selection. */
export function selectionLabel(m: Market, sel: Selection): string {
  if (sel.kind === "binary") return sel.side === "yes" ? "Yes" : "No";
  return m.outcomes?.[sel.outcome]?.label ?? `Outcome ${sel.outcome + 1}`;
}
