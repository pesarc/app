// Multi-EVM chain registry for the prediction-market + P2P-liquidity layer.
//
// The contracts (PredictionMarket, IntentMatcher, RealizedRateOracle,
// AgentSessionKeys) are chain-agnostic Solidity — deploy them on ANY EVM chain,
// Uniswap-style. This registry is how the app learns about a chain.
//
// IMPORTANT: NEXT_PUBLIC_* vars are inlined into the client bundle only when
// referenced as STATIC literals (never process.env[computed]). So each chain
// lists its env reads literally in RAW below. To support a new EVM chain:
//   1. add its viem chain + a literal RAW block here,
//   2. deploy the contract suite to it,
//   3. set its NEXT_PUBLIC_<PREFIX>_* addresses in env,
//   4. (optional) NEXT_PUBLIC_ACTIVE_CHAIN=<key> to make it the default.

import { createPublicClient, http, type Chain } from "viem";
import {
  celo,
  celoSepolia,
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  optimism,
  optimismSepolia,
  polygon,
  mainnet,
  sepolia,
} from "viem/chains";

export type TokenSymbol = "NGN" | "KES" | "GHS" | "USD";

export type EvmChainConfig = {
  key: string;
  label: string;
  chain: Chain;
  testnet: boolean;
  rpcUrl: string;
  predictionMarket: `0x${string}` | "";
  realizedOracle: `0x${string}` | "";
  intentMatcher: `0x${string}` | "";
  agentSessionKeys: `0x${string}` | "";
  agentKey: `0x${string}` | "";
  tokens: Partial<Record<TokenSymbol, `0x${string}`>>;
};

type Raw = {
  rpc?: string;
  predictionMarket?: string;
  realizedOracle?: string;
  intentMatcher?: string;
  agentSessionKeys?: string;
  agentKey?: string;
  tokenNGN?: string;
  tokenKES?: string;
  tokenGHS?: string;
  tokenUSD?: string;
};

type CatalogEntry = { key: string; label: string; chain: Chain; testnet: boolean; raw: Raw };

// One literal block per chain (see note above about static NEXT_PUBLIC access).
const CATALOG: CatalogEntry[] = [
  {
    key: "celo-sepolia", label: "Celo Sepolia", chain: celoSepolia, testnet: true,
    raw: {
      rpc: process.env.NEXT_PUBLIC_CELO_RPC_URL,
      predictionMarket: process.env.NEXT_PUBLIC_CELO_PREDICTION_MARKET,
      realizedOracle: process.env.NEXT_PUBLIC_CELO_REALIZED_ORACLE,
      intentMatcher: process.env.NEXT_PUBLIC_CELO_INTENT_MATCHER,
      agentSessionKeys: process.env.NEXT_PUBLIC_CELO_AGENT_SESSION_KEYS,
      agentKey: process.env.NEXT_PUBLIC_CELO_AGENT_KEY,
      tokenNGN: process.env.NEXT_PUBLIC_CELO_TOKEN_NGN,
      tokenKES: process.env.NEXT_PUBLIC_CELO_TOKEN_KES,
      tokenGHS: process.env.NEXT_PUBLIC_CELO_TOKEN_GHS,
      tokenUSD: process.env.NEXT_PUBLIC_CELO_TOKEN_USD,
    },
  },
  {
    key: "base-sepolia", label: "Base Sepolia", chain: baseSepolia, testnet: true,
    raw: {
      rpc: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
      predictionMarket: process.env.NEXT_PUBLIC_BASE_SEPOLIA_PREDICTION_MARKET,
      realizedOracle: process.env.NEXT_PUBLIC_BASE_SEPOLIA_REALIZED_ORACLE,
      intentMatcher: process.env.NEXT_PUBLIC_BASE_SEPOLIA_INTENT_MATCHER,
      agentSessionKeys: process.env.NEXT_PUBLIC_BASE_SEPOLIA_AGENT_SESSION_KEYS,
      agentKey: process.env.NEXT_PUBLIC_BASE_SEPOLIA_AGENT_KEY,
      tokenNGN: process.env.NEXT_PUBLIC_BASE_SEPOLIA_TOKEN_NGN,
      tokenKES: process.env.NEXT_PUBLIC_BASE_SEPOLIA_TOKEN_KES,
      tokenGHS: process.env.NEXT_PUBLIC_BASE_SEPOLIA_TOKEN_GHS,
      tokenUSD: process.env.NEXT_PUBLIC_BASE_SEPOLIA_TOKEN_USD,
    },
  },
  {
    key: "base", label: "Base", chain: base, testnet: false,
    raw: {
      rpc: process.env.NEXT_PUBLIC_BASE_RPC_URL,
      predictionMarket: process.env.NEXT_PUBLIC_BASE_PREDICTION_MARKET,
      realizedOracle: process.env.NEXT_PUBLIC_BASE_REALIZED_ORACLE,
      intentMatcher: process.env.NEXT_PUBLIC_BASE_INTENT_MATCHER,
      agentSessionKeys: process.env.NEXT_PUBLIC_BASE_AGENT_SESSION_KEYS,
      agentKey: process.env.NEXT_PUBLIC_BASE_AGENT_KEY,
      tokenNGN: process.env.NEXT_PUBLIC_BASE_TOKEN_NGN,
      tokenKES: process.env.NEXT_PUBLIC_BASE_TOKEN_KES,
      tokenGHS: process.env.NEXT_PUBLIC_BASE_TOKEN_GHS,
      tokenUSD: process.env.NEXT_PUBLIC_BASE_TOKEN_USD,
    },
  },
  {
    key: "arbitrum-sepolia", label: "Arbitrum Sepolia", chain: arbitrumSepolia, testnet: true,
    raw: {
      rpc: process.env.NEXT_PUBLIC_ARB_SEPOLIA_RPC_URL,
      predictionMarket: process.env.NEXT_PUBLIC_ARB_SEPOLIA_PREDICTION_MARKET,
      realizedOracle: process.env.NEXT_PUBLIC_ARB_SEPOLIA_REALIZED_ORACLE,
      intentMatcher: process.env.NEXT_PUBLIC_ARB_SEPOLIA_INTENT_MATCHER,
      agentSessionKeys: process.env.NEXT_PUBLIC_ARB_AGENT_SESSION_KEYS,
      agentKey: process.env.NEXT_PUBLIC_ARB_AGENT_KEY,
      tokenNGN: process.env.NEXT_PUBLIC_ARB_TOKEN_NGN,
      tokenKES: process.env.NEXT_PUBLIC_ARB_TOKEN_KES,
      tokenGHS: process.env.NEXT_PUBLIC_ARB_TOKEN_GHS,
      tokenUSD: process.env.NEXT_PUBLIC_ARB_TOKEN_USD,
    },
  },
  {
    key: "arbitrum", label: "Arbitrum", chain: arbitrum, testnet: false,
    raw: {
      rpc: process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL,
      predictionMarket: process.env.NEXT_PUBLIC_ARBITRUM_PREDICTION_MARKET,
      realizedOracle: process.env.NEXT_PUBLIC_ARBITRUM_REALIZED_ORACLE,
      intentMatcher: process.env.NEXT_PUBLIC_ARBITRUM_INTENT_MATCHER,
      agentSessionKeys: process.env.NEXT_PUBLIC_ARBITRUM_AGENT_SESSION_KEYS,
      agentKey: process.env.NEXT_PUBLIC_ARBITRUM_AGENT_KEY,
      tokenNGN: process.env.NEXT_PUBLIC_ARBITRUM_TOKEN_NGN,
      tokenKES: process.env.NEXT_PUBLIC_ARBITRUM_TOKEN_KES,
      tokenGHS: process.env.NEXT_PUBLIC_ARBITRUM_TOKEN_GHS,
      tokenUSD: process.env.NEXT_PUBLIC_ARBITRUM_TOKEN_USD,
    },
  },
  {
    key: "optimism", label: "Optimism", chain: optimism, testnet: false,
    raw: {
      rpc: process.env.NEXT_PUBLIC_OPTIMISM_RPC_URL,
      predictionMarket: process.env.NEXT_PUBLIC_OPTIMISM_PREDICTION_MARKET,
      realizedOracle: process.env.NEXT_PUBLIC_OPTIMISM_REALIZED_ORACLE,
      intentMatcher: process.env.NEXT_PUBLIC_OPTIMISM_INTENT_MATCHER,
      agentSessionKeys: process.env.NEXT_PUBLIC_OPTIMISM_AGENT_SESSION_KEYS,
      agentKey: process.env.NEXT_PUBLIC_OPTIMISM_AGENT_KEY,
      tokenNGN: process.env.NEXT_PUBLIC_OPTIMISM_TOKEN_NGN,
      tokenKES: process.env.NEXT_PUBLIC_OPTIMISM_TOKEN_KES,
      tokenGHS: process.env.NEXT_PUBLIC_OPTIMISM_TOKEN_GHS,
      tokenUSD: process.env.NEXT_PUBLIC_OPTIMISM_TOKEN_USD,
    },
  },
  {
    key: "optimism-sepolia", label: "OP Sepolia", chain: optimismSepolia, testnet: true,
    raw: {
      rpc: process.env.NEXT_PUBLIC_OP_SEPOLIA_RPC_URL,
      predictionMarket: process.env.NEXT_PUBLIC_OP_SEPOLIA_PREDICTION_MARKET,
      realizedOracle: process.env.NEXT_PUBLIC_OP_SEPOLIA_REALIZED_ORACLE,
      intentMatcher: process.env.NEXT_PUBLIC_OP_SEPOLIA_INTENT_MATCHER,
      agentSessionKeys: process.env.NEXT_PUBLIC_OP_SEPOLIA_AGENT_SESSION_KEYS,
      agentKey: process.env.NEXT_PUBLIC_OP_SEPOLIA_AGENT_KEY,
      tokenNGN: process.env.NEXT_PUBLIC_OP_SEPOLIA_TOKEN_NGN,
      tokenKES: process.env.NEXT_PUBLIC_OP_SEPOLIA_TOKEN_KES,
      tokenGHS: process.env.NEXT_PUBLIC_OP_SEPOLIA_TOKEN_GHS,
      tokenUSD: process.env.NEXT_PUBLIC_OP_SEPOLIA_TOKEN_USD,
    },
  },
  {
    key: "polygon", label: "Polygon", chain: polygon, testnet: false,
    raw: {
      rpc: process.env.NEXT_PUBLIC_POLYGON_RPC_URL,
      predictionMarket: process.env.NEXT_PUBLIC_POLYGON_PREDICTION_MARKET,
      realizedOracle: process.env.NEXT_PUBLIC_POLYGON_REALIZED_ORACLE,
      intentMatcher: process.env.NEXT_PUBLIC_POLYGON_INTENT_MATCHER,
      agentSessionKeys: process.env.NEXT_PUBLIC_POLYGON_AGENT_SESSION_KEYS,
      agentKey: process.env.NEXT_PUBLIC_POLYGON_AGENT_KEY,
      tokenNGN: process.env.NEXT_PUBLIC_POLYGON_TOKEN_NGN,
      tokenKES: process.env.NEXT_PUBLIC_POLYGON_TOKEN_KES,
      tokenGHS: process.env.NEXT_PUBLIC_POLYGON_TOKEN_GHS,
      tokenUSD: process.env.NEXT_PUBLIC_POLYGON_TOKEN_USD,
    },
  },
  {
    key: "celo", label: "Celo", chain: celo, testnet: false,
    raw: {
      rpc: process.env.NEXT_PUBLIC_CELO_MAINNET_RPC_URL,
      predictionMarket: process.env.NEXT_PUBLIC_CELO_MAINNET_PREDICTION_MARKET,
      realizedOracle: process.env.NEXT_PUBLIC_CELO_MAINNET_REALIZED_ORACLE,
      intentMatcher: process.env.NEXT_PUBLIC_CELO_MAINNET_INTENT_MATCHER,
      agentSessionKeys: process.env.NEXT_PUBLIC_CELO_MAINNET_AGENT_SESSION_KEYS,
      agentKey: process.env.NEXT_PUBLIC_CELO_MAINNET_AGENT_KEY,
      tokenNGN: process.env.NEXT_PUBLIC_CELO_MAINNET_TOKEN_NGN,
      tokenKES: process.env.NEXT_PUBLIC_CELO_MAINNET_TOKEN_KES,
      tokenGHS: process.env.NEXT_PUBLIC_CELO_MAINNET_TOKEN_GHS,
      tokenUSD: process.env.NEXT_PUBLIC_CELO_MAINNET_TOKEN_USD,
    },
  },
  {
    key: "sepolia", label: "Ethereum Sepolia", chain: sepolia, testnet: true,
    raw: {
      rpc: process.env.NEXT_PUBLIC_ETH_SEPOLIA_RPC_URL,
      predictionMarket: process.env.NEXT_PUBLIC_ETH_SEPOLIA_PREDICTION_MARKET,
      realizedOracle: process.env.NEXT_PUBLIC_ETH_SEPOLIA_REALIZED_ORACLE,
      intentMatcher: process.env.NEXT_PUBLIC_ETH_SEPOLIA_INTENT_MATCHER,
      agentSessionKeys: process.env.NEXT_PUBLIC_ETH_SEPOLIA_AGENT_SESSION_KEYS,
      agentKey: process.env.NEXT_PUBLIC_ETH_SEPOLIA_AGENT_KEY,
      tokenNGN: process.env.NEXT_PUBLIC_ETH_SEPOLIA_TOKEN_NGN,
      tokenKES: process.env.NEXT_PUBLIC_ETH_SEPOLIA_TOKEN_KES,
      tokenGHS: process.env.NEXT_PUBLIC_ETH_SEPOLIA_TOKEN_GHS,
      tokenUSD: process.env.NEXT_PUBLIC_ETH_SEPOLIA_TOKEN_USD,
    },
  },
  {
    key: "ethereum", label: "Ethereum", chain: mainnet, testnet: false,
    raw: {
      rpc: process.env.NEXT_PUBLIC_ETH_RPC_URL,
      predictionMarket: process.env.NEXT_PUBLIC_ETH_PREDICTION_MARKET,
      realizedOracle: process.env.NEXT_PUBLIC_ETH_REALIZED_ORACLE,
      intentMatcher: process.env.NEXT_PUBLIC_ETH_INTENT_MATCHER,
      agentSessionKeys: process.env.NEXT_PUBLIC_ETH_AGENT_SESSION_KEYS,
      agentKey: process.env.NEXT_PUBLIC_ETH_AGENT_KEY,
      tokenNGN: process.env.NEXT_PUBLIC_ETH_TOKEN_NGN,
      tokenKES: process.env.NEXT_PUBLIC_ETH_TOKEN_KES,
      tokenGHS: process.env.NEXT_PUBLIC_ETH_TOKEN_GHS,
      tokenUSD: process.env.NEXT_PUBLIC_ETH_TOKEN_USD,
    },
  },
];

function pick(v?: string): `0x${string}` | "" {
  return v ? (v as `0x${string}`) : "";
}

function build(e: CatalogEntry): EvmChainConfig {
  const tokens: Partial<Record<TokenSymbol, `0x${string}`>> = {};
  if (e.raw.tokenNGN) tokens.NGN = e.raw.tokenNGN as `0x${string}`;
  if (e.raw.tokenKES) tokens.KES = e.raw.tokenKES as `0x${string}`;
  if (e.raw.tokenGHS) tokens.GHS = e.raw.tokenGHS as `0x${string}`;
  if (e.raw.tokenUSD) tokens.USD = e.raw.tokenUSD as `0x${string}`;
  return {
    key: e.key,
    label: e.label,
    chain: e.chain,
    testnet: e.testnet,
    rpcUrl: e.raw.rpc || e.chain.rpcUrls.default.http[0],
    predictionMarket: pick(e.raw.predictionMarket),
    realizedOracle: pick(e.raw.realizedOracle),
    intentMatcher: pick(e.raw.intentMatcher),
    agentSessionKeys: pick(e.raw.agentSessionKeys),
    agentKey: pick(e.raw.agentKey),
    tokens,
  };
}

/** Every catalog chain, resolved from env. */
export function allChains(): EvmChainConfig[] {
  return CATALOG.map(build);
}

/** Chains that actually have a PredictionMarket deployed (i.e. usable). */
export function configuredChains(): EvmChainConfig[] {
  return allChains().filter((c) => Boolean(c.predictionMarket));
}

/** The chain the app reads by default. */
export function activeChain(): EvmChainConfig {
  const want = process.env.NEXT_PUBLIC_ACTIVE_CHAIN;
  const configured = configuredChains();
  if (want) {
    const hit =
      configured.find((c) => c.key === want) || allChains().find((c) => c.key === want);
    if (hit) return hit;
  }
  return configured[0] ?? build(CATALOG[0]);
}

export function chainByKey(key: string): EvmChainConfig | undefined {
  return allChains().find((c) => c.key === key);
}

export function publicClientFor(c: EvmChainConfig) {
  return createPublicClient({ chain: c.chain, transport: http(c.rpcUrl) });
}

export function explorerAddressUrl(c: EvmChainConfig, address: string): string {
  const base = c.chain.blockExplorers?.default.url ?? "";
  return base ? `${base}/address/${address}` : "";
}

export function explorerTxUrl(c: EvmChainConfig, hash: string): string {
  const base = c.chain.blockExplorers?.default.url ?? "";
  return base ? `${base}/tx/${hash}` : "";
}
