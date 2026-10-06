// Chainlink FX price feeds on Base mainnet — decentralized, verifiable on-chain
// rates. Read-only. Used as the PRIMARY rate source wherever a feed exists, with
// off-chain APIs as the fallback for currencies Chainlink doesn't cover
// (KES/GHS/EGP/…). All Chainlink FX feeds are 8-decimal and report USD per 1
// unit of the base currency (e.g. NGN/USD ≈ 0.000755 USD per ₦1), which is our
// `usdPer` convention. Override the RPC with BASE_RPC_URL.

import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

/** currency code -> Chainlink proxy on Base mainnet. Verified against the
 *  Chainlink feed directory (docs.chain.link). */
export const CHAINLINK_BASE_FX: Record<string, `0x${string}`> = {
  NGN: "0x74535Ecc46F5F1e1614b830b3B3cCdc08EF02482",
  ZAR: "0x1D292e75f586f4B2638b9C81300d58aD6299c0Da",
  GBP: "0x2e46086480909c2049F372DE72Ba5a2fAB281eE9",
  EUR: "0x46ba9365C7CE12224504cF8581f061a6942f8516",
  CHF: "0x61d85c6cCE419845c2DfC20130B4f120C10B2105",
  CAD: "0x9D779986f861810CadA370F04F524226d150fb7F",
  AUD: "0xBe5bC9c1d407a0D97C34A73FbA19118b478F427d",
  SGD: "0x3860668e752604a6734e3d812E14DF14d2B3Ae48",
  PHP: "0xCc23537f501104321Ba1b4D450e7F0dc673c456E",
};

const FEED_DECIMALS = 8; // all Chainlink FX feeds use 8 decimals
// Tolerate up to ~2x the 1h heartbeat before treating a feed as stale.
const MAX_AGE_MS = 2 * 60 * 60_000;

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

function baseClient() {
  return createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org"),
  });
}

/** True when Chainlink has a Base feed for this currency. */
export function hasChainlinkFeed(currency: string): boolean {
  return Boolean(CHAINLINK_BASE_FX[currency.toUpperCase()]);
}

/**
 * USD per 1 unit of `currency` from Chainlink on Base (the `usdPer` convention),
 * or null when there's no feed, the data is stale, or the read fails — so the
 * caller falls back to an off-chain source.
 */
export async function chainlinkUsdPer(currency: string): Promise<number | null> {
  const feed = CHAINLINK_BASE_FX[currency.toUpperCase()];
  if (!feed) return null;
  try {
    const [, answer, , updatedAt] = (await baseClient().readContract({
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
