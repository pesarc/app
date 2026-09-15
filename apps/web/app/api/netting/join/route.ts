import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createWalletClient,
  createPublicClient,
  http,
  isAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { HUB_CHAIN, hubRpcUrl } from "@pesarc/sdk/chain/chains";
import { CONTRACTS } from "@pesarc/sdk/chain/contracts";
import { settlementNettingAbi } from "@pesarc/abi";
import { NETTING_SET_ID } from "@pesarc/sdk/chain/netting";
import { requireOperator, rateLimit } from "@pesarc/sdk/api/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ address: z.string() });

/**
 * Testnet stand-in for KYB onboarding: the set operator (server-held key)
 * approves a wallet into the demo netting set. Operator-authenticated so
 * arbitrary addresses can't spam the member set / bypass the KYB gate; real
 * KYB replaces this route wholesale — the contract call stays identical.
 */
export async function POST(request: Request) {
  const denied = requireOperator(request) ?? rateLimit(request, "join", 10, 60_000);
  if (denied) return denied;

  const pk = process.env.SETTLE_OPERATOR_PK;
  if (!pk || !CONTRACTS.settlementNetting) {
    return NextResponse.json(
      { ok: false, error: "Join is not enabled on this deployment." },
      { status: 501 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success || !isAddress(parsed.data.address)) {
    return NextResponse.json({ ok: false, error: "Invalid address." }, { status: 400 });
  }
  const member = parsed.data.address as `0x${string}`;
  const netting = CONTRACTS.settlementNetting as `0x${string}`;
  const transport = http(hubRpcUrl());
  const publicClient = createPublicClient({ chain: HUB_CHAIN, transport });

  try {
    const already = (await publicClient.readContract({
      address: netting,
      abi: settlementNettingAbi,
      functionName: "isMember",
      args: [NETTING_SET_ID, member],
    })) as boolean;
    if (already) return NextResponse.json({ ok: true, status: "already" });

    const account = privateKeyToAccount(
      (pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`
    );
    const wallet = createWalletClient({ account, chain: HUB_CHAIN, transport });
    const hash = await wallet.writeContract({
      address: netting,
      abi: settlementNettingAbi,
      functionName: "addMember",
      args: [NETTING_SET_ID, member],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return NextResponse.json({ ok: true, status: "joined", tx: hash });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message.slice(0, 200) : "Join failed.",
      },
      { status: 500 }
    );
  }
}
