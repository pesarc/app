// Celo submission — "Agents at Work" hackathon.
//
// The local-currency settlement stack (IntentMatcher + RealizedRateOracle),
// ported to Celo where cNGN/cKES/cUSD are native and gas is payable in
// stablecoins. Chain-agnostic contracts; only addresses + RPC change vs the
// Arbitrum deployment.
//
// NETWORK SELECTION. The hackathon rules are "Celo mainnet only — testnet
// activity counts for nothing in every track", so the submission has to run on
// mainnet to score. Set:
//
//   NEXT_PUBLIC_CELO_NETWORK=mainnet
//
// and the NEXT_PUBLIC_CELO_MAINNET_* addresses below. The default stays
// `sepolia` deliberately: flipping to mainnet moves real funds, so it is an
// explicit opt-in rather than something that happens because a var is unset.
//
// NEXT_PUBLIC_* vars are only inlined into the client bundle when referenced as
// STATIC literals, never process.env[computed] — hence both sets are written
// out longhand and picked between.

import { createPublicClient, http, type Chain } from "viem";
import { celo, celoSepolia } from "viem/chains";

const NETWORK = (process.env.NEXT_PUBLIC_CELO_NETWORK ?? "sepolia").trim().toLowerCase();

/** True when this build targets Celo mainnet (the only network that scores). */
export const CELO_IS_MAINNET = NETWORK === "mainnet" || NETWORK === "celo";

export const CELO_CHAIN: Chain = CELO_IS_MAINNET ? celo : celoSepolia;

const MAINNET_FALLBACK_RPC = "https://forno.celo.org";

export function celoRpcUrl(): string {
  const url = CELO_IS_MAINNET
    ? process.env.NEXT_PUBLIC_CELO_MAINNET_RPC_URL
    : process.env.NEXT_PUBLIC_CELO_RPC_URL;
  if (url) return url;
  return CELO_IS_MAINNET
    ? MAINNET_FALLBACK_RPC
    : CELO_CHAIN.rpcUrls.default.http[0];
}

export function celoPublicClient() {
  return createPublicClient({ chain: CELO_CHAIN, transport: http(celoRpcUrl()) });
}

function explorerBase(): string {
  return (
    CELO_CHAIN.blockExplorers?.default.url ??
    (CELO_IS_MAINNET ? "https://celoscan.io" : "https://celo-sepolia.blockscout.com")
  );
}

export function celoExplorerTx(hash: string): string {
  return `${explorerBase()}/tx/${hash}`;
}

export function celoExplorerAddress(addr: string): string {
  return `${explorerBase()}/address/${addr}`;
}

function addr(mainnet?: string, sepolia?: string): `0x${string}` | "" {
  const v = CELO_IS_MAINNET ? mainnet : sepolia;
  return (v as `0x${string}`) || "";
}

export const CELO = {
  intentMatcher: addr(
    process.env.NEXT_PUBLIC_CELO_MAINNET_INTENT_MATCHER,
    process.env.NEXT_PUBLIC_CELO_INTENT_MATCHER,
  ),
  realizedOracle: addr(
    process.env.NEXT_PUBLIC_CELO_MAINNET_REALIZED_ORACLE,
    process.env.NEXT_PUBLIC_CELO_REALIZED_ORACLE,
  ),
  predictionMarket: addr(
    process.env.NEXT_PUBLIC_CELO_MAINNET_PREDICTION_MARKET,
    process.env.NEXT_PUBLIC_CELO_PREDICTION_MARKET,
  ),
  agentSessionKeys: addr(
    process.env.NEXT_PUBLIC_CELO_MAINNET_AGENT_SESSION_KEYS,
    process.env.NEXT_PUBLIC_CELO_AGENT_SESSION_KEYS,
  ),
  agentKey: addr(
    process.env.NEXT_PUBLIC_CELO_MAINNET_AGENT_KEY,
    process.env.NEXT_PUBLIC_CELO_AGENT_KEY,
  ),
} as const;

export type CeloCurrency = {
  code: string;
  name: string;
  flag: string;
  symbol: string;
  address: `0x${string}`;
};

/** Local stables the agent can move on Celo. */
export function celoCurrencies(): CeloCurrency[] {
  const defs: Array<[string, string, string, string, `0x${string}` | ""]> = [
    [
      "NGN",
      "Nigerian Naira",
      "🇳🇬",
      "₦",
      addr(process.env.NEXT_PUBLIC_CELO_MAINNET_TOKEN_NGN, process.env.NEXT_PUBLIC_CELO_TOKEN_NGN),
    ],
    [
      "GHS",
      "Ghanaian Cedi",
      "🇬🇭",
      "₵",
      addr(process.env.NEXT_PUBLIC_CELO_MAINNET_TOKEN_GHS, process.env.NEXT_PUBLIC_CELO_TOKEN_GHS),
    ],
    [
      "KES",
      "Kenyan Shilling",
      "🇰🇪",
      "KSh",
      addr(process.env.NEXT_PUBLIC_CELO_MAINNET_TOKEN_KES, process.env.NEXT_PUBLIC_CELO_TOKEN_KES),
    ],
  ];
  return defs
    .filter(([, , , , a]) => Boolean(a))
    .map(([code, name, flag, symbol, a]) => ({
      code,
      name,
      flag,
      symbol,
      address: a as `0x${string}`,
    }));
}

export function celoCurrencyByCode(code: string): CeloCurrency | undefined {
  return celoCurrencies().find((c) => c.code.toUpperCase() === code.toUpperCase());
}

export function celoAgentReady(): boolean {
  return Boolean(CELO.intentMatcher) && celoCurrencies().length >= 2;
}

/**
 * Whether this build's on-chain activity can score in the hackathon. Testnet
 * transactions are explicitly worth nothing in every track, so surface it
 * rather than letting a green demo hide it.
 */
export function celoScoringStatus(): { scoring: boolean; network: string; reason?: string } {
  if (!CELO_IS_MAINNET) {
    return {
      scoring: false,
      network: "celo-sepolia",
      reason: "testnet activity counts for nothing — set NEXT_PUBLIC_CELO_NETWORK=mainnet",
    };
  }
  if (!celoAgentReady()) {
    return {
      scoring: false,
      network: "celo",
      reason: "mainnet selected but contract addresses are unset",
    };
  }
  return { scoring: true, network: "celo" };
}
