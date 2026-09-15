import { NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { HUB_CHAIN, hubRpcUrl } from "@/lib/chain/chains";
import { CONTRACTS } from "@/lib/chain/contracts";
import { settlementNettingAbi } from "@/lib/chain/abi/settlementNetting";
import { NETTING_SET_ID } from "@/lib/chain/netting";
import { requireOperator, rateLimit } from "@/lib/api/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Runs a settlement cycle from the operator key. Testnet stand-in for the
 * scheduled netting CRON (Reactive Network per Engineering Spec §3.5).
 * Operator-authenticated: settlement spends the operator's gas, so it must
 * not be triggerable anonymously.
 */
export async function POST(request: Request) {
  const denied = requireOperator(request) ?? rateLimit(request, "settle", 5, 60_000);
  if (denied) return denied;

  const pk = process.env.SETTLE_OPERATOR_PK;
  if (!pk || !CONTRACTS.settlementNetting) {
    return NextResponse.json(
      { ok: false, error: "Settlement is not enabled on this deployment." },
      { status: 501 }
    );
  }

  const transport = http(hubRpcUrl());
  try {
    const account = privateKeyToAccount(
      (pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`
    );
    const wallet = createWalletClient({ account, chain: HUB_CHAIN, transport });
    const publicClient = createPublicClient({ chain: HUB_CHAIN, transport });

    const hash = await wallet.writeContract({
      address: CONTRACTS.settlementNetting as `0x${string}`,
      abi: settlementNettingAbi,
      functionName: "settle",
      args: [NETTING_SET_ID],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return NextResponse.json({
      ok: receipt.status === "success",
      tx: hash,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message.slice(0, 200)
            : "Settlement failed.",
      },
      { status: 500 }
    );
  }
}
