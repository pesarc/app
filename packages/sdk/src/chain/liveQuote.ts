// Live USD→NGN pricing from the on-chain hub (read-only, no wallet needed):
// the oracle supplies the mid-market rate and the V4Quoter lens returns the
// exact all-in output — dynamic hook fee, insurance premium, and price impact
// included. Safe in client or server.

import { parseUnits, formatUnits } from "viem";
import { getPublicClient, chainLabel } from "./chains";
import { CONTRACTS, CONTRACTS_READY } from "./contracts";
import { oracleAdapterAbi } from "@pesarc/abi";
import { quoterAbi } from "@pesarc/abi";
import { activeChain } from "./registry";
import { realizedRateOn, tokenByCode } from "./evm-settle";

export type LivePoolQuote = {
  /** Oracle mid-market rate (NGN per USD). */
  midRate: number;
  /** Exact all-in output for the requested input. */
  receiveAmount: number;
  /** receiveAmount / sendAmount. */
  effectiveRate: number;
  /** All-in cost vs mid, as a fraction (fee + premium + impact). */
  feePct: number;
  /** Where the price came from. */
  route: string;
};

function poolKey() {
  return {
    currency0: CONTRACTS.tokenUsd as `0x${string}`,
    currency1: CONTRACTS.tokenNgn as `0x${string}`,
    fee: CONTRACTS.fee,
    tickSpacing: CONTRACTS.tickSpacing,
    hooks: (CONTRACTS.hook ||
      "0x0000000000000000000000000000000000000000") as `0x${string}`,
  };
}

/** True when live pool quoting is possible on the configured hub chain. */
export function livePoolQuoteAvailable(): boolean {
  return Boolean(CONTRACTS_READY && CONTRACTS.oracleAdapter && CONTRACTS.quoter);
}

/**
 * Quotes an exact-input USD→NGN send against the live hub pool.
 * Returns null when the pool isn't configured or the reads fail (callers
 * should keep showing the mock quote in that case).
 */
export async function fetchLivePoolQuote(
  sendAmountUsd: number
): Promise<LivePoolQuote | null> {
  if (!livePoolQuoteAvailable() || sendAmountUsd <= 0) return null;

  try {
    const client = getPublicClient();
    const key = poolKey();
    const amountWei = parseUnits(sendAmountUsd.toFixed(6), 18);

    const [midRate1e18, quoteSim] = await Promise.all([
      client.readContract({
        address: CONTRACTS.oracleAdapter as `0x${string}`,
        abi: oracleAdapterAbi,
        functionName: "getPrice1e18Strict",
        args: [key],
      }) as Promise<bigint>,
      // V4Quoter is nonpayable (it quotes by reverting internally), so it
      // has to go through an eth_call simulation rather than a plain read.
      client.simulateContract({
        address: CONTRACTS.quoter as `0x${string}`,
        abi: quoterAbi,
        functionName: "quoteExactInputSingle",
        args: [
          {
            poolKey: key,
            zeroForOne: true, // USD (token0) -> NGN (token1)
            exactAmount: amountWei,
            hookData: "0x",
          },
        ],
      }),
    ]);

    const [amountOut] = quoteSim.result as readonly [bigint, bigint];
    if (amountOut <= 0n) return null;

    const receiveAmount = Number(formatUnits(amountOut, 18));
    const midRate = Number(formatUnits(midRate1e18, 18));
    const effectiveRate = receiveAmount / sendAmountUsd;
    const feePct = midRate > 0 ? Math.max(0, 1 - effectiveRate / midRate) : 0;

    return {
      midRate,
      receiveAmount,
      effectiveRate,
      feePct,
      route: `Hub pool · ${chainLabel()}`,
    };
  } catch {
    return null;
  }
}

// ---- corridor-agnostic quoting (any currency, via the realized-rate oracle) ----
// The Uniswap-pool quote above only covers the USD/NGN hub pool. Every other
// corridor (cGHS, cKES, …) prices off the realized-rate oracle instead — the
// same rate DeployCorridor seeds — so a corridor goes live for quoting the
// moment its rate exists, with no pool required. Netting has no pool impact, so
// a flat settlement fee stands in for the pool's dynamic fee.
const CORRIDOR_FEE = 0.004; // 0.4%

/** Live quote for USD -> receiveCurrency from this chain's realized-rate oracle. */
export async function fetchOracleCorridorQuote(
  sendAmountUsd: number,
  receiveCurrency: string,
): Promise<LivePoolQuote | null> {
  if (sendAmountUsd <= 0) return null;
  const chain = activeChain();
  const usd = tokenByCode(chain, "USD");
  const target = tokenByCode(chain, receiveCurrency);
  if (!usd || !target) return null;

  const rate = await realizedRateOn(chain, usd.address, target.address);
  if (rate <= 0) return null;

  const effectiveRate = rate * (1 - CORRIDOR_FEE);
  return {
    midRate: rate,
    receiveAmount: sendAmountUsd * effectiveRate,
    effectiveRate,
    feePct: CORRIDOR_FEE,
    route: `Realized rate · ${chain.label}`,
  };
}

/**
 * Best live quote for a corridor: the rich hub pool for NGN when configured,
 * otherwise the realized-rate oracle for any seeded corridor. Returns null when
 * there's no live price (caller keeps the indicative mock quote).
 */
export async function fetchCorridorQuote(
  sendAmountUsd: number,
  receiveCurrency: string,
): Promise<LivePoolQuote | null> {
  if (receiveCurrency === "NGN" && livePoolQuoteAvailable()) {
    const pool = await fetchLivePoolQuote(sendAmountUsd);
    if (pool) return pool;
  }
  return fetchOracleCorridorQuote(sendAmountUsd, receiveCurrency);
}
