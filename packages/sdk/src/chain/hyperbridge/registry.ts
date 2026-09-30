// Hyperbridge cross-chain registry — the second rail beside CCTP. CCTP moves USDC
// (and everything to/from Arc); Hyperbridge moves the coins CCTP can't: our local
// stablecoins and USDT/PYUSD, across the EVM chains Hyperbridge supports (Arc is
// NOT one of them — see docs/HYPERBRIDGE_INTEGRATION.md).
//
// Moving a token over Hyperbridge needs a HyperFungibleToken contract set deployed
// + peered for THAT coin on each chain. Until a coin's `deployments` are filled in
// (from the deploy scripts), `hyperRouteFor` returns null and the UI says the
// route isn't live yet — we never pretend a move will work when the contracts
// don't exist.

export type HyperNetwork = "mainnet" | "testnet";

/** EVM chains Hyperbridge supports that we care about, per network. Chain ids only
 *  — protocol (IsmpHost / dispatcher) addresses come from @hyperbridge/sdk's
 *  chainConfigs at deploy time, never hardcoded here. */
export const HYPER_CHAINS: Record<HyperNetwork, { key: string; label: string; chainId: number }[]> = {
  mainnet: [
    { key: "ethereum", label: "Ethereum", chainId: 1 },
    { key: "optimism", label: "Optimism", chainId: 10 },
    { key: "arbitrum", label: "Arbitrum", chainId: 42161 },
    { key: "base", label: "Base", chainId: 8453 },
    { key: "polygon", label: "Polygon", chainId: 137 },
    { key: "bnb", label: "BNB Chain", chainId: 56 },
    { key: "gnosis", label: "Gnosis", chainId: 100 },
  ],
  testnet: [
    { key: "ethereum", label: "Ethereum Sepolia", chainId: 11155111 },
    { key: "optimism", label: "OP Sepolia", chainId: 11155420 },
    { key: "arbitrum", label: "Arbitrum Sepolia", chainId: 421614 },
    { key: "base", label: "Base Sepolia", chainId: 84532 },
    { key: "polygon", label: "Polygon Amoy", chainId: 80002 },
    { key: "bnb", label: "BNB Testnet", chainId: 97 },
    { key: "gnosis", label: "Gnosis Chiado", chainId: 10200 },
  ],
};

/** A coin Hyperbridge can carry, and where its HFT contracts are deployed. */
export type HyperToken = {
  symbol: string;
  /** Canonical supply chain (holds the WrappedHyperFungibleToken). */
  homeChainId: number;
  /** chainId -> deployed HFT contract for this coin. Empty until deployed. A
   *  "wrapped" (home) entry also carries the underlying ERC20 it locks, which the
   *  sender must approve before a send. */
  deployments: Record<
    number,
    { address: `0x${string}`; kind: "wrapped" | "remote"; underlying?: `0x${string}` }
  >;
};

// The coins we route over Hyperbridge. USDC is deliberately absent — it stays on
// CCTP. A coin appears here once its cross-chain contracts are deployed + peered.
export const HYPER_TOKENS: Record<HyperNetwork, Record<string, HyperToken>> = {
  mainnet: {},
  testnet: {
    // First proof deployment: a wrapped test naira, Base Sepolia (home) <-> Arb
    // Sepolia (remote). Contracts are live + peered; the in-app send path follows.
    cNGN: {
      symbol: "cNGN",
      homeChainId: 84532,
      deployments: {
        84532: {
          address: "0x1BAd624c31986f5F5Aa335eB4f1db6CB5749f8a5",
          kind: "wrapped",
          underlying: "0x3340973253CaAAAAb22624b15d75b1659b9704Aa",
        },
        421614: { address: "0x240372d47D3085060a0e8eaA21d0B9a86745edFF", kind: "remote" },
      },
    },
  },
};

/** Does this coin have a live cross-chain deployment (contracts on 2+ chains)? */
export function hasHyperRoute(network: HyperNetwork, symbol: string): boolean {
  const token = HYPER_TOKENS[network][symbol];
  return !!token && Object.keys(token.deployments).length >= 2;
}

/** The chains a coin is deployed on, with labels, for the send form. */
export function hyperEndpoints(
  network: HyperNetwork,
  symbol: string,
): { chainId: number; label: string }[] {
  const token = HYPER_TOKENS[network][symbol];
  if (!token) return [];
  const byId = new Map(HYPER_CHAINS[network].map((c) => [c.chainId, c.label]));
  return Object.keys(token.deployments).map((id) => ({
    chainId: Number(id),
    label: byId.get(Number(id)) ?? `Chain ${id}`,
  }));
}

/** Is this coin routable between these two chains over Hyperbridge right now?
 *  Returns the two deployment endpoints, or null when either side isn't deployed. */
export function hyperRouteFor(
  network: HyperNetwork,
  symbol: string,
  fromChainId: number,
  toChainId: number,
): { from: `0x${string}`; to: `0x${string}` } | null {
  const token = HYPER_TOKENS[network][symbol];
  if (!token) return null;
  const from = token.deployments[fromChainId];
  const to = token.deployments[toChainId];
  if (!from || !to) return null;
  return { from: from.address, to: to.address };
}

/** Coins we plan to move over Hyperbridge (whether or not a route is live yet),
 *  so the UI can offer them and explain status. USDC is not here (CCTP owns it). */
export const HYPER_ELIGIBLE_SYMBOLS = [
  "cNGN",
  "cKES",
  "cGHS",
  "cZAR",
  "cEGP",
  "USDT",
  "PYUSD",
] as const;
