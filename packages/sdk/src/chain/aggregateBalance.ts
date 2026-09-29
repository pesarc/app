// Cumulative wallet balance across every supported chain, converted to one
// denomination (the user's stablecoin currency). It unions the REAL registry
// stablecoins (USDC, USDT, PYUSD, EURC, cNGN, …) with the app's own settlement
// tokens per chain (deduped by address), so both real holdings and test-token
// balances show up. Per-token AMOUNTS are read live on-chain; the cross-currency
// conversion into a single denomination uses indicative FX (money.ts), so the
// total is an approximation. Fails soft: an unreadable token/chain is skipped.

import { formatUnits } from "viem";
import { erc20Abi } from "@pesarc/abi";
import { balanceChains, publicClientFor, type TokenSymbol } from "./registry";
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
    balanceChains().map(async (chain) => {
      const client = publicClientFor(chain);

      // Union: real registry stablecoins + the app's settlement tokens, deduped
      // by address. Registry entries carry a symbol; app tokens read it on-chain.
      const seen = new Set<string>();
      const toRead: { address: `0x${string}`; fiat: CurrencyCode; symbol?: string }[] = [];
      for (const coin of realStablecoinsForAppChain(chain.key, chain.testnet)) {
        const key = coin.address.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        toRead.push({ address: coin.address, fiat: coin.fiat, symbol: coin.symbol });
      }
      for (const [code, address] of Object.entries(chain.tokens) as [TokenSymbol, `0x${string}`][]) {
        if (!address) continue;
        const key = address.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        toRead.push({ address, fiat: code as CurrencyCode });
      }

      await Promise.all(
        toRead.map(async (t) => {
          try {
            const [bal, dec, sym] = await Promise.all([
              client.readContract({
                address: t.address,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: [owner],
              }) as Promise<bigint>,
              client
                .readContract({ address: t.address, abi: erc20Abi, functionName: "decimals" })
                .then((d) => Number(d))
                .catch(() => 18),
              t.symbol
                ? Promise.resolve(t.symbol)
                : client
                    .readContract({ address: t.address, abi: erc20Abi, functionName: "symbol" })
                    .then((s) => String(s))
                    .catch(() => t.fiat),
            ]);
            const amount = Number(formatUnits(bal, dec));
            if (amount <= 0) return;
            const valueInDenom =
              t.fiat === denom ? amount : amount * midMarketRate(t.fiat, denom);
            holdings.push({
              chainKey: chain.key,
              chainLabel: chain.label,
              fiat: t.fiat,
              symbol: sym,
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
