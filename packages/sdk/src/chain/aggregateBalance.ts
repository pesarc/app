// Cumulative wallet balance across every supported chain, converted to one
// denomination (the user's stablecoin currency). It reads the REAL stablecoins
// from the stablecoin registry (USDC, USDT, PYUSD, EURC, cNGN, …) per chain and
// network, not the app's internal settlement tokens. Per-token AMOUNTS are read
// live on-chain; the cross-currency conversion into a single denomination uses
// indicative FX (money.ts), so the total is an approximation of real holdings.
// Fails soft: a chain or token that can't be read is skipped, never throws.

import { formatUnits } from "viem";
import { erc20Abi } from "@pesarc/abi";
import { configuredChains, publicClientFor } from "./registry";
import { realStablecoinsForAppChain } from "./stablecoin-registry";
import { midMarketRate, type CurrencyCode } from "../money";

export type TokenHolding = {
  chainKey: string;
  chainLabel: string;
  fiat: CurrencyCode; // the fiat the stablecoin tracks
  symbol: string; // real stablecoin symbol (USDC, cNGN, …)
  amount: number; // human amount, in the token's own currency
  valueInDenom: number; // amount converted to the denomination currency
};

export type AggregatedBalance = {
  denom: CurrencyCode;
  total: number; // sum of valueInDenom across all holdings
  holdings: TokenHolding[]; // non-zero holdings, richest first
};

/** Read every configured chain's real stablecoins for `owner`, summed into `denom`. */
export async function fetchAggregatedBalance(
  owner: `0x${string}`,
  denom: CurrencyCode,
): Promise<AggregatedBalance> {
  const holdings: TokenHolding[] = [];

  await Promise.all(
    configuredChains().map(async (chain) => {
      const client = publicClientFor(chain);
      const coins = realStablecoinsForAppChain(chain.key, chain.testnet);
      await Promise.all(
        coins.map(async (coin) => {
          try {
            const [bal, dec] = await Promise.all([
              client.readContract({
                address: coin.address,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: [owner],
              }) as Promise<bigint>,
              client
                .readContract({ address: coin.address, abi: erc20Abi, functionName: "decimals" })
                .then((d) => Number(d))
                .catch(() => 18),
            ]);
            const amount = Number(formatUnits(bal, dec));
            if (amount <= 0) return;
            const valueInDenom =
              coin.fiat === denom ? amount : amount * midMarketRate(coin.fiat, denom);
            holdings.push({
              chainKey: chain.key,
              chainLabel: chain.label,
              fiat: coin.fiat,
              symbol: coin.symbol,
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
