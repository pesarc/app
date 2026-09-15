import { NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { HUB_CHAIN, hubRpcUrl } from "@pesarc/sdk/chain/chains";
import { requireOperator, rateLimit } from "@pesarc/sdk/api/guard";
import { fetchUsdRate } from "@pesarc/sdk/oracle/fx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The corridor's Chainlink-style aggregator (8-decimal answer = NGN per USD).
// The OracleAdapter reads this with on-chain staleness protection; this route
// is the keeper that keeps it fresh from a live off-chain FX source.
const AGGREGATOR = (process.env.NEXT_PUBLIC_ARB_FX_AGGREGATOR ||
  "0xb3387B3cCAd4ef68e0c348735daA1C306D17C004") as `0x${string}`;

const aggregatorAbi = [
  {
    type: "function",
    name: "setAnswer",
    stateMutability: "nonpayable",
    inputs: [{ name: "_answer", type: "int256" }],
    outputs: [],
  },
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

/**
 * Oracle keeper: reads the live USD→quote FX rate off-chain and pushes it
 * on-chain into the corridor aggregator. Operator-authenticated + rate
 * limited — this spends the operator's gas. Intended to be called on a
 * schedule (cron) as well as on demand. GET returns the current on-chain +
 * live rates without writing (read-only preview).
 */
export async function GET() {
  try {
    const [live, onchain] = await Promise.all([
      fetchUsdRate("NGN"),
      currentOnchainRate(),
    ]);
    return NextResponse.json({ ok: true, live, onchain });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "read failed" },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  const denied =
    requireOperator(request) ?? rateLimit(request, "oracle", 30, 60_000);
  if (denied) return denied;

  const pk = process.env.SETTLE_OPERATOR_PK;
  if (!pk) {
    return NextResponse.json(
      { ok: false, error: "Oracle keeper is not enabled on this deployment." },
      { status: 501 },
    );
  }

  try {
    const fx = await fetchUsdRate("NGN");
    // NGN per USD, 8 decimals (Chainlink FX convention).
    const answer = BigInt(Math.round(fx.rate * 1e8));

    const transport = http(hubRpcUrl());
    const account = privateKeyToAccount(
      (pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`,
    );
    const wallet = createWalletClient({ account, chain: HUB_CHAIN, transport });
    const publicClient = createPublicClient({ chain: HUB_CHAIN, transport });

    const hash = await wallet.writeContract({
      address: AGGREGATOR,
      abi: aggregatorAbi,
      functionName: "setAnswer",
      args: [answer],
    });
    await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });

    return NextResponse.json({
      ok: true,
      pushed: { rate: fx.rate, source: fx.source, asOf: fx.asOf },
      tx: hash,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message.slice(0, 160) : "push failed" },
      { status: 500 },
    );
  }
}

async function currentOnchainRate() {
  const publicClient = createPublicClient({
    chain: HUB_CHAIN,
    transport: http(hubRpcUrl()),
  });
  const [, answer, , updatedAt] = (await publicClient.readContract({
    address: AGGREGATOR,
    abi: aggregatorAbi,
    functionName: "latestRoundData",
  })) as readonly [bigint, bigint, bigint, bigint, bigint];
  return {
    rate: Number(answer) / 1e8,
    updatedAt: Number(updatedAt),
  };
}
