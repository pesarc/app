// Venue-neutral market reads. The UI calls fetchLiveMarkets()/activeVenue()
// and never cares whether the active home is an EVM chain or Solana — the
// first step of the "one product, two homes" plan (docs/MULTI_CHAIN.md).

import { fetchLiveMarkets as fetchEvmMarkets, type LiveMarket } from "./markets.live";
import { activeChain, explorerAddressUrl } from "./chain/registry";
import { svmConfig, svmExplorerAccount } from "./svm/config";

export type Venue = {
  kind: "evm" | "svm";
  label: string;
  /** Explorer link to the live prediction-market contract/program, if any. */
  explorerUrl: string;
};

/** Is the active venue Solana? Selected via NEXT_PUBLIC_ACTIVE_CHAIN=solana*. */
function svmSelected(): boolean {
  const want = (process.env.NEXT_PUBLIC_ACTIVE_CHAIN || "").toLowerCase();
  if (want.startsWith("solana") || want.startsWith("svm")) return true;
  // Auto-fallback: no EVM prediction market configured but an SVM one is.
  return !activeChain().predictionMarket && Boolean(svmConfig().predictionMarket) && want === "";
}

export function activeVenue(): Venue {
  if (svmSelected()) {
    const c = svmConfig();
    return {
      kind: "svm",
      label: c.label,
      explorerUrl: c.predictionMarket ? svmExplorerAccount(c.predictionMarket, c) : "",
    };
  }
  const c = activeChain();
  return {
    kind: "evm",
    label: c.label,
    explorerUrl: c.predictionMarket ? explorerAddressUrl(c, c.predictionMarket) : "",
  };
}

/** Live markets from whichever venue is active. Fails soft (null → mock).
 *  The Solana adapter (and @solana/web3.js) is loaded only when SVM is active,
 *  so it never weighs down the EVM path. */
export async function fetchLiveMarkets(): Promise<LiveMarket[] | null> {
  if (svmSelected()) {
    const { fetchSvmMarkets } = await import("./svm/markets.live");
    return fetchSvmMarkets();
  }
  return fetchEvmMarkets();
}

export type { LiveMarket };
