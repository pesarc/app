import { NextResponse } from "next/server";
import { z } from "zod";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { rateLimit } from "@pesarc/sdk/api/guard";
import {
  CCTP_MAINNET,
  MESSAGE_TRANSMITTER_V2,
  cctpChainByDomain,
} from "@pesarc/sdk/chain/cctp/mainnet";
import { messageTransmitterV2Abi } from "@pesarc/sdk/chain/cctp/abi";
import { viemChainFor } from "@pesarc/sdk/chain/cctp/bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const IRIS = "https://iris-api.circle.com";

const schema = z.object({
  srcDomain: z.number().int().nonnegative(),
  burnTx: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  dstKey: z.string().min(1),
});

// Finalize a CCTP V2 burn: fetch Circle's attestation for the burn tx, then call
// receiveMessage on the destination so USDC mints to the recipient encoded in
// the message. Non-custodial: the relayer only pays destination gas — it cannot
// redirect funds (mintRecipient is fixed in the attested message).
export async function POST(request: Request) {
  const limited = rateLimit(request, "bridge-relay", 12, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }
  const { srcDomain, burnTx, dstKey } = parsed.data;

  const dst = CCTP_MAINNET[dstKey];
  if (!dst || dst.kind !== "evm") {
    return NextResponse.json({ ok: false, error: "Unsupported destination." }, { status: 400 });
  }
  if (!cctpChainByDomain(srcDomain)) {
    return NextResponse.json({ ok: false, error: "Unknown source domain." }, { status: 400 });
  }

  const pk = process.env.BRIDGE_RELAYER_PK || process.env.SETTLE_OPERATOR_PK;
  if (!pk) {
    return NextResponse.json(
      { ok: false, error: "Bridge relayer not configured." },
      { status: 503 },
    );
  }

  // 1. Fetch Circle's attestation for this burn (source domain scopes the query).
  let message: string | undefined;
  let attestation: string | undefined;
  try {
    const res = await fetch(
      `${IRIS}/v2/messages/${srcDomain}?transactionHash=${burnTx}`,
      { cache: "no-store" },
    );
    if (res.ok) {
      const data = (await res.json()) as {
        messages?: { status: string; message: string; attestation: string }[];
      };
      const m = data.messages?.find((x) => x.status === "complete");
      if (m) {
        message = m.message;
        attestation = m.attestation;
      }
    }
  } catch {
    /* fall through to pending */
  }
  if (!message || !attestation) {
    // Attestation not ready yet — the client should poll again shortly.
    return NextResponse.json({ ok: false, pending: true, error: "Attestation pending." });
  }

  // 2. Mint on the destination via receiveMessage (relayer pays dest gas).
  try {
    const chain = viemChainFor(dst);
    const account = privateKeyToAccount(pk as `0x${string}`);
    const transport = http(chain.rpcUrls.default.http[0]);
    const wallet = createWalletClient({ account, chain, transport });
    const pub = createPublicClient({ chain, transport });

    const mintTx = await wallet.writeContract({
      address: MESSAGE_TRANSMITTER_V2,
      abi: messageTransmitterV2Abi,
      functionName: "receiveMessage",
      args: [message as `0x${string}`, attestation as `0x${string}`],
    });
    await pub.waitForTransactionReceipt({ hash: mintTx, timeout: 45_000 });
    return NextResponse.json({ ok: true, mintTx, explorer: dst.explorerTx(mintTx) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Mint failed.";
    // "Nonce already used" means someone already minted it — treat as success-ish.
    if (/already|used|spent/i.test(msg)) {
      return NextResponse.json({ ok: false, error: "Already minted." });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
