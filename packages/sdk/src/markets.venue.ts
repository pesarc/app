// Venue-neutral market reads. The UI calls fetchLiveMarkets()/activeVenue() and
// never cares whether a home is an EVM chain or Solana — the "one product, two
// homes" plan (docs/MULTI_CHAIN.md). availableVenues() powers a venue switcher.

import { fetchLiveMarkets as fetchEvmMarkets, type LiveMarket } from "./markets.live";
import { activeChain, explorerAddressUrl } from "./chain/registry";
import { svmConfig, svmExplorerAccount } from "./svm/config";

export type VenueKind = "evm" | "svm";

export type Venue = {
  kind: VenueKind;
  label: string;
  /** Explorer link to the live prediction-market contract/program, if any. */
  explorerUrl: string;
};

function evmVenue(): Venue | null {
  const c = activeChain();
  if (!c.predictionMarket) return null;
  return { kind: "evm", label: c.label, explorerUrl: explorerAddressUrl(c, c.predictionMarket) };
}

function svmVenue(): Venue | null {
  // Only surfaced when a Solana program is explicitly configured.
  if (!process.env.NEXT_PUBLIC_SVM_PREDICTION_MARKET) return null;
  const c = svmConfig();
  return { kind: "svm", label: c.label, explorerUrl: svmExplorerAccount(c.predictionMarket, c) };
}

/** All homes that have a prediction market configured. */
export function availableVenues(): Venue[] {
  return [evmVenue(), svmVenue()].filter(Boolean) as Venue[];
}

/** Whether Solana is the default selection (NEXT_PUBLIC_ACTIVE_CHAIN=solana*). */
function svmSelected(): boolean {
  const want = (process.env.NEXT_PUBLIC_ACTIVE_CHAIN || "").toLowerCase();
  if (want.startsWith("solana") || want.startsWith("svm")) return true;
  return !activeChain().predictionMarket && Boolean(svmVenue());
}

export function activeVenue(): Venue {
  const venues = availableVenues();
  const want: VenueKind = svmSelected() ? "svm" : "evm";
  return venues.find((v) => v.kind === want) ?? venues[0] ?? { kind: "evm", label: "", explorerUrl: "" };
}

/** Live markets from a specific venue. The Solana adapter (+ @solana/web3.js)
 *  loads lazily, so it never weighs down the EVM path. */
export async function fetchLiveMarketsFor(kind: VenueKind): Promise<LiveMarket[] | null> {
  if (kind === "svm") {
    const { fetchSvmMarkets } = await import("./svm/markets.live");
    return fetchSvmMarkets();
  }
  return fetchEvmMarkets();
}

/** Live markets from whichever venue is active by default. */
export function fetchLiveMarkets(): Promise<LiveMarket[] | null> {
  return fetchLiveMarketsFor(activeVenue().kind);
}

export type VenueMarkets = { venue: Venue; markets: LiveMarket[] | null };

/** Fetch every configured venue at once — powers the merged multi-venue board. */
export async function fetchAllVenues(): Promise<VenueMarkets[]> {
  const venues = availableVenues();
  return Promise.all(
    venues.map(async (venue) => ({ venue, markets: await fetchLiveMarketsFor(venue.kind) })),
  );
}

export type { LiveMarket };
