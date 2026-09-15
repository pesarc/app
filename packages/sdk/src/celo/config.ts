// Celo submission — "Agents at Work" hackathon.
//
// The local-currency settlement stack (IntentMatcher + RealizedRateOracle),
// ported to Celo where cNGN/cKES/cUSD are native and gas is payable in
// stablecoins. Chain-agnostic contracts; only addresses + RPC change vs the
// Arbitrum deployment.

import { createPublicClient, http, type Chain } from "viem";
import { celoSepolia } from "viem/chains";

export const CELO_CHAIN: Chain = celoSepolia;

export function celoRpcUrl(): string {
  return (
    process.env.NEXT_PUBLIC_CELO_RPC_URL ||
    CELO_CHAIN.rpcUrls.default.http[0]
  );
}

export function celoPublicClient() {
  return createPublicClient({ chain: CELO_CHAIN, transport: http(celoRpcUrl()) });
}

export function celoExplorerTx(hash: string): string {
  return `${CELO_CHAIN.blockExplorers?.default.url ?? "https://celo-sepolia.blockscout.com"}/tx/${hash}`;
}

export const CELO = {
  intentMatcher: (process.env.NEXT_PUBLIC_CELO_INTENT_MATCHER as `0x${string}`) || "",
  realizedOracle: (process.env.NEXT_PUBLIC_CELO_REALIZED_ORACLE as `0x${string}`) || "",
  predictionMarket: (process.env.NEXT_PUBLIC_CELO_PREDICTION_MARKET as `0x${string}`) || "",
  agentSessionKeys: (process.env.NEXT_PUBLIC_CELO_AGENT_SESSION_KEYS as `0x${string}`) || "",
} as const;

export function celoExplorerAddress(addr: string): string {
  return `${CELO_CHAIN.blockExplorers?.default.url ?? "https://celo-sepolia.blockscout.com"}/address/${addr}`;
}

export type CeloCurrency = {
  code: string;
  name: string;
  flag: string;
  symbol: string;
  address: `0x${string}`;
};

/** Local stables the agent can move on Celo. */
export function celoCurrencies(): CeloCurrency[] {
  const defs: Array<[string, string, string, string, string | undefined]> = [
    ["NGN", "Nigerian Naira", "🇳🇬", "₦", process.env.NEXT_PUBLIC_CELO_TOKEN_NGN],
    ["GHS", "Ghanaian Cedi", "🇬🇭", "₵", process.env.NEXT_PUBLIC_CELO_TOKEN_GHS],
    ["KES", "Kenyan Shilling", "🇰🇪", "KSh", process.env.NEXT_PUBLIC_CELO_TOKEN_KES],
  ];
  return defs
    .filter(([, , , , addr]) => Boolean(addr))
    .map(([code, name, flag, symbol, addr]) => ({
      code,
      name,
      flag,
      symbol,
      address: addr as `0x${string}`,
    }));
}

export function celoCurrencyByCode(code: string): CeloCurrency | undefined {
  return celoCurrencies().find((c) => c.code.toUpperCase() === code.toUpperCase());
}

export function celoAgentReady(): boolean {
  return Boolean(CELO.intentMatcher) && celoCurrencies().length >= 2;
}
