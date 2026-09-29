// Cumulative wallet balance across every supported chain and token, converted to
// one denomination (the user's stablecoin currency). Per-token AMOUNTS are read
// live on-chain; the cross-currency conversion into a single denomination uses
// indicative FX (money.ts), so the total is an approximation of real holdings.
// Fails soft: a chain or token that can't be read is skipped, never throws.

import { formatUnits } from "viem";
import { erc20Abi } from "@pesarc/abi";
import { configuredChains, publicClientFor, type TokenSymbol } from "./registry";
import { midMarketRate, type CurrencyCode } from "../money";

/** Display stablecoin symbol per settlement currency (USD -> USDC, etc.). */
export const STABLE_SYMBOL: Record<string, string> = {
  USD: "USDC",
  NGN: "cNGN",
  KES: "cKES",
  GHS: "cGHS",
};

export type TokenHolding = {
  chainKey: string;
  chainLabel: string;
  code: TokenSymbol; // currency code (also the token key on the chain)
  symbol: string; // display stablecoin symbol
  amount: number; // human amount, in the token's own currency
  valueInDenom: number; // amount converted to the denomination currency
};

export type AggregatedBalance = {
  denom: CurrencyCode;
  total: number; // sum of valueInDenom across all holdings
  holdings: TokenHolding[]; // non-zero holdings, richest first
};

/** Read every configured chain × token for `owner`, summed into `denom`. */
export async function fetchAggregatedBalance(
  owner: `0x${string}`,
  denom: CurrencyCode,
): Promise<AggregatedBalance> {
  const holdings: TokenHolding[] = [];

  await Promise.all(
    configuredChains().map(async (chain) => {
      const client = publicClientFor(chain);
      const entries = Object.entries(chain.tokens) as [TokenSymbol, `0x${string}`][];
      await Promise.all(
        entries.map(async ([code, address]) => {
          try {
            const [bal, dec] = await Promise.all([
              client.readContract({
                address,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: [owner],
              }) as Promise<bigint>,
              client
                .readContract({ address, abi: erc20Abi, functionName: "decimals" })
                .then((d) => Number(d))
                .catch(() => 18),
            ]);
            const amount = Number(formatUnits(bal, dec));
            if (amount <= 0) return;
            const valueInDenom =
              code === denom ? amount : amount * midMarketRate(code as CurrencyCode, denom);
            holdings.push({
              chainKey: chain.key,
              chainLabel: chain.label,
              code,
              symbol: STABLE_SYMBOL[code] ?? code,
              amount,
              valueInDenom,
            });
          } catch {
            /* unreadable token/chain — skip */
          }
        }),
      );
    }),
  );

  holdings.sort((a, b) => b.valueInDenom - a.valueInDenom);
  const total = holdings.reduce((sum, h) => sum + h.valueInDenom, 0);
  return { denom, total, holdings };
}
