// Wormhole chain registry — the config that makes Wormhole a real, extensible
// rail. Wormhole reaches far more ecosystems than CCTP or Hyperbridge (EVM +
// Solana + Algorand + Sui + Aptos + Cosmos…), so this is the table you extend
// when you add a new chain: one entry here lights it up in the Wormhole Connect
// widget and the crosschain router. We drive Wormhole through the AUDITED Connect
// widget (never hand-rolled transfer/redeem code), so adding a chain is config,
// not new money code.

import { registryChainKey } from "../stablecoin-registry";

export type WormholeNetwork = "mainnet" | "testnet";

export type WormholeChain = {
  /** Canonical base key — matches the CCTP / stablecoin registry base keys where
   *  they overlap (e.g. "arbitrum", "base", "solana"), so a CrossSendRequest's
   *  chain key resolves here after registryChainKey() normalisation. */
  key: string;
  label: string;
  kind: "evm" | "svm" | "algorand" | "sui" | "aptos" | "cosmos" | "other";
  /** Mainnet EVM chain id, when applicable. */
  chainId?: number;
  /** Wormhole's own chain name per network (what Connect + the SDK expect). A
   *  missing entry means that chain isn't available on that network. */
  names: { mainnet?: string; testnet?: string };
};

/** Add a chain by adding a row. `names` uses Wormhole's chain naming. */
export const WORMHOLE_CHAINS: WormholeChain[] = [
  { key: "ethereum", label: "Ethereum", kind: "evm", chainId: 1, names: { mainnet: "Ethereum", testnet: "Sepolia" } },
  { key: "arbitrum", label: "Arbitrum", kind: "evm", chainId: 42161, names: { mainnet: "Arbitrum", testnet: "ArbitrumSepolia" } },
  { key: "base", label: "Base", kind: "evm", chainId: 8453, names: { mainnet: "Base", testnet: "BaseSepolia" } },
  { key: "optimism", label: "Optimism", kind: "evm", chainId: 10, names: { mainnet: "Optimism", testnet: "OptimismSepolia" } },
  { key: "polygon", label: "Polygon", kind: "evm", chainId: 137, names: { mainnet: "Polygon" } },
  { key: "avalanche", label: "Avalanche", kind: "evm", chainId: 43114, names: { mainnet: "Avalanche", testnet: "Avalanche" } },
  { key: "solana", label: "Solana", kind: "svm", names: { mainnet: "Solana", testnet: "Solana" } },
  { key: "algorand", label: "Algorand", kind: "algorand", names: { mainnet: "Algorand" } },
  // Non-EVM ecosystems Wormhole covers that CCTP / Hyperbridge don't — wire the
  // app chain + balances when you adopt one; the Wormhole rail is already ready.
  { key: "sui", label: "Sui", kind: "sui", names: { mainnet: "Sui", testnet: "Sui" } },
  { key: "aptos", label: "Aptos", kind: "aptos", names: { mainnet: "Aptos", testnet: "Aptos" } },
];

/** Resolve a chain (by app key like "arbitrum-sepolia" or base key) for a network. */
export function wormholeChain(chainKey: string, network: WormholeNetwork): WormholeChain | undefined {
  const base = registryChainKey(chainKey);
  const c = WORMHOLE_CHAINS.find((w) => w.key === base || w.key === chainKey);
  return c && c.names[network] ? c : undefined;
}

/** Wormhole's chain name for Connect/SDK, or undefined if unsupported on network. */
export function wormholeName(chainKey: string, network: WormholeNetwork): string | undefined {
  return wormholeChain(chainKey, network)?.names[network];
}

/** True when Wormhole can route between two distinct supported chains. */
export function hasWormholeRoute(from: string, to: string, network: WormholeNetwork): boolean {
  const a = wormholeChain(from, network);
  const b = wormholeChain(to, network);
  return Boolean(a && b && a.key !== b.key);
}

/** The chain-name allowlist for the Connect widget on a network (plus any extras
 *  you want pinned first, e.g. the specific from/to of a handoff). */
export function wormholeConnectChains(network: WormholeNetwork, extra: string[] = []): string[] {
  const all = WORMHOLE_CHAINS.map((c) => c.names[network]).filter(Boolean) as string[];
  return Array.from(new Set([...extra, ...all]));
}
