// Chainlink FX price feeds — decentralized, verifiable on-chain rates. Read-only.
// Used as the PRIMARY rate source wherever a feed exists, with off-chain APIs as
// the fallback for currencies/chains Chainlink doesn't cover.
//
// Coverage (verified against the Chainlink feed directory, docs.chain.link):
//   • Base mainnet    — widest: NGN, ZAR, GBP, EUR, CHF, CAD, AUD, SGD, PHP
//   • Arbitrum One     — majors only: EUR, JPY, GBP, SGD, CNY, AUD, CAD, PHP, CHF
//   • Arc (Circle L1)  — NO Chainlink feeds yet. Arc relies on the push-oracle:
//     the keeper reads these feeds and pushes the value to the Arc/hub
//     aggregator, so Arc still gets Chainlink-grade data without a native feed.
//
// All Chainlink FX feeds are 8-decimal and report USD per 1 unit of the base
// currency (NGN/USD ≈ 0.000755 USD per ₦1) — our `usdPer` convention. Per-chain
// RPC overrides: BASE_RPC_URL, ARBITRUM_RPC_URL.

import { createPublicClient, http, type Chain } from "viem";
import { base, arbitrum } from "viem/chains";

export type FeedChainKey = "base" | "arbitrum";

const CHAINS: Record<FeedChainKey, { chain: Chain; rpc: () => string }> = {
  base: { chain: base, rpc: () => process.env.BASE_RPC_URL || "https://mainnet.base.org" },
  arbitrum: {
    chain: arbitrum,
    rpc: () => process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
  },
};

/** Per-chain Chainlink FX feeds: currency -> proxy address. */
const FEEDS: Record<FeedChainKey, Record<string, `0x${string}`>> = {
  base: {
    NGN: "0x74535Ecc46F5F1e1614b830b3B3cCdc08EF02482",
    ZAR: "0x1D292e75f586f4B2638b9C81300d58aD6299c0Da",
    GBP: "0x2e46086480909c2049F372DE72Ba5a2fAB281eE9",
    EUR: "0x46ba9365C7CE12224504cF8581f061a6942f8516",
    CHF: "0x61d85c6cCE419845c2DfC20130B4f120C10B2105",
    CAD: "0x9D779986f861810CadA370F04F524226d150fb7F",
    AUD: "0xBe5bC9c1d407a0D97C34A73FbA19118b478F427d",
    SGD: "0x3860668e752604a6734e3d812E14DF14d2B3Ae48",
    PHP: "0xCc23537f501104321Ba1b4D450e7F0dc673c456E",
  },
  arbitrum: {
    EUR: "0x1Ce4eeeA2E091f8EcDe210B4F82AAeE05158DDDd",
    JPY: "0x4c75337F1FaF726fb1Db8f1e3876D9dF1A34a9DD",
    GBP: "0x55Ccdb9002A2e82A5daedF8178C94946f3c29298",
    SGD: "0x5ADa8E598331e98250F4ffab6Fe7fA022DfCb477",
    CNY: "0x74827EA909fe3DDf0200D105aE1D5B517f5Ce92F",
    AUD: "0x86825dA4a6D07F7060206C1A4C7569142b31d59d",
    CAD: "0x868503e6FE61afC4702f68A61B94938d095C0e71",
    PHP: "0xae3F80d26aA94a46CF0a95eEB3fE8977736be018",
    CHF: "0xd98Bf129728C863c10A48A166d2a82Bc93D4d22f",
  },
};

// Order tried when no chain is specified. Base first — widest coverage and the
// only chain with NGN/ZAR; Arbitrum backs up the majors.
const PRIORITY: FeedChainKey[] = ["base", "arbitrum"];

/** Base-mainnet feed map (kept for back-compat / direct iteration). */
export const CHAINLINK_BASE_FX = FEEDS.base;

const FEED_DECIMALS = 8; // all Chainlink FX feeds use 8 decimals
const MAX_AGE_MS = 2 * 60 * 60_000; // tolerate ~2x the 1h heartbeat before stale

const aggV3Abi = [
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

/** True when Chainlink has a feed for this currency on any supported chain (or a
 *  specific one when `chain` is given). */
export function hasChainlinkFeed(currency: string, chain?: FeedChainKey): boolean {
  const c = currency.toUpperCase();
  if (chain) return Boolean(FEEDS[chain]?.[c]);
  return PRIORITY.some((k) => Boolean(FEEDS[k][c]));
}

/** Every currency with a Chainlink feed on any supported chain (the union). */
export function chainlinkCoveredCurrencies(): string[] {
  const set = new Set<string>();
  for (const k of PRIORITY) for (const c of Object.keys(FEEDS[k])) set.add(c);
  return [...set];
}

async function readFeed(chainKey: FeedChainKey, feed: `0x${string}`): Promise<number | null> {
  try {
    const { chain, rpc } = CHAINS[chainKey];
    const client = createPublicClient({ chain, transport: http(rpc()) });
    const [, answer, , updatedAt] = (await client.readContract({
      address: feed,
      abi: aggV3Abi,
      functionName: "latestRoundData",
    })) as readonly [bigint, bigint, bigint, bigint, bigint];
    if (answer <= 0n) return null;
    if (Date.now() - Number(updatedAt) * 1000 > MAX_AGE_MS) return null; // stale
    return Number(answer) / 10 ** FEED_DECIMALS;
  } catch {
    return null;
  }
}

/**
 * USD per 1 unit of `currency` from Chainlink (the `usdPer` convention), or null
 * when no feed exists, the data is stale, or every read fails. With `chain` it
 * reads that chain only; otherwise it tries the priority order (Base, then
 * Arbitrum) and returns the first fresh value.
 */
export async function chainlinkUsdPer(
  currency: string,
  chain?: FeedChainKey,
): Promise<number | null> {
  const c = currency.toUpperCase();
  const order = chain ? [chain] : PRIORITY;
  for (const k of order) {
    const feed = FEEDS[k]?.[c];
    if (!feed) continue;
    const v = await readFeed(k, feed);
    if (v && v > 0) return v;
  }
  return null;
}
