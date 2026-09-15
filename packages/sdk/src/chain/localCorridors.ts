// Local-currency corridors (docs/LOCAL_CURRENCY_SETTLEMENT.md).
// These settle intent-to-intent — no pool, no bridge, no USD. Read-only
// helpers, safe in client or server.

import { formatUnits } from "viem";
import { getPublicClient } from "./chains";
import { CONTRACTS } from "./contracts";
import { intentMatcherAbi, realizedRateOracleAbi } from "@pesarc/abi";

export type LocalCurrency = {
  code: string;
  name: string;
  flag: string;
  symbol: string;
  address: `0x${string}`;
};

/** The local stables the corridor mesh settles in. */
export function localCurrencies(): LocalCurrency[] {
  const list: LocalCurrency[] = [];
  if (CONTRACTS.tokenNgn) {
    list.push({
      code: "NGN",
      name: "Nigerian Naira",
      flag: "🇳🇬",
      symbol: "₦",
      address: CONTRACTS.tokenNgn as `0x${string}`,
    });
  }
  if (CONTRACTS.tokenGhs) {
    list.push({
      code: "GHS",
      name: "Ghanaian Cedi",
      flag: "🇬🇭",
      symbol: "₵",
      address: CONTRACTS.tokenGhs as `0x${string}`,
    });
  }
  if (CONTRACTS.tokenKes) {
    list.push({
      code: "KES",
      name: "Kenyan Shilling",
      flag: "🇰🇪",
      symbol: "KSh",
      address: CONTRACTS.tokenKes as `0x${string}`,
    });
  }
  return list;
}

export function currencyByAddress(addr: string): LocalCurrency | undefined {
  return localCurrencies().find(
    (c) => c.address.toLowerCase() === addr.toLowerCase(),
  );
}

export function localCorridorsReady(): boolean {
  return Boolean(CONTRACTS.intentMatcher) && localCurrencies().length >= 2;
}

export type IntentStatus = "open" | "settled" | "expired";

export type UserIntent = {
  id: bigint;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: number;
  minAmountOut: number;
  remainingIn: number;
  /** Portion already settled, in tokenIn units. */
  filledIn: number;
  expiry: number;
  status: IntentStatus;
};

/** Reads the caller's intents, newest first. */
export async function fetchUserIntents(
  maker: `0x${string}`,
  limit = 12,
): Promise<UserIntent[]> {
  if (!CONTRACTS.intentMatcher) return [];
  const client = getPublicClient();
  const address = CONTRACTS.intentMatcher as `0x${string}`;

  try {
    const count = (await client.readContract({
      address,
      abi: intentMatcherAbi,
      functionName: "intentCount",
    })) as bigint;

    const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
    const rows = await Promise.all(
      ids.map(
        (id) =>
          client.readContract({
            address,
            abi: intentMatcherAbi,
            functionName: "intents",
            args: [id],
          }) as Promise<
            readonly [
              string, string, string, string, bigint, bigint, bigint, bigint, boolean,
            ]
          >,
      ),
    );

    const now = Math.floor(Date.now() / 1000);
    const mine: UserIntent[] = [];
    rows.forEach((r, i) => {
      if (r[0].toLowerCase() !== maker.toLowerCase()) return;
      const amountIn = r[4];
      const remainingIn = r[6];
      const expiry = Number(r[7]);
      const active = r[8];
      const filled = amountIn - remainingIn;

      let status: IntentStatus;
      if (!active || remainingIn === 0n) status = "settled";
      else if (expiry <= now) status = "expired";
      else status = "open";

      mine.push({
        id: ids[i],
        tokenIn: r[2] as `0x${string}`,
        tokenOut: r[3] as `0x${string}`,
        amountIn: Number(formatUnits(amountIn, 18)),
        minAmountOut: Number(formatUnits(r[5], 18)),
        remainingIn: Number(formatUnits(remainingIn, 18)),
        filledIn: Number(formatUnits(filled, 18)),
        expiry,
        status,
      });
    });
    return mine.reverse().slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * The realized rate for a pair, discovered from our own settled flow —
 * no external feed, no USD reference. Null when the pair has no prints yet.
 */
export async function fetchRealizedRate(
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
): Promise<number | null> {
  if (!CONTRACTS.realizedRateOracle) return null;
  try {
    const client = getPublicClient();
    const address = CONTRACTS.realizedRateOracle as `0x${string}`;
    const has = (await client.readContract({
      address,
      abi: realizedRateOracleAbi,
      functionName: "hasData",
      args: [tokenIn, tokenOut],
    })) as boolean;
    if (!has) return null;
    const rate = (await client.readContract({
      address,
      abi: realizedRateOracleAbi,
      functionName: "latestRate1e18",
      args: [tokenIn, tokenOut],
    })) as bigint;
    return Number(formatUnits(rate, 18));
  } catch {
    return null;
  }
}
