import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { rateLimit } from "@stablearc/sdk/api/guard";
import { HUB_CHAIN, hubRpcUrl } from "@stablearc/sdk/chain/chains";
import {
  CORRIDORS,
  HUB_BRIDGE_RECEIVER,
  MESSAGE_TRANSMITTER,
  IRIS_API,
  SOLANA_CHAIN_ID,
  SOLANA_CORRIDOR,
  SOLANA_INTENT_EVENT_DISC,
  spokeGatewayAbi,
  messageTransmitterAbi,
  bridgeReceiverAbi,
} from "@stablearc/sdk/chain/corridors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  /** Spoke chain id the burn happened on (103 = Solana devnet). */
  chainId: z.number(),
  /** Burn tx: 0x hash on EVM spokes, base58 signature on Solana. */
  txHash: z
    .string()
    .regex(/^(0x[0-9a-fA-F]{64}|[1-9A-HJ-NP-Za-km-z]{64,90})$/),
});

type Intent = {
  hubRecipient: `0x${string}`;
  amount: bigint;
  convertToLocal: boolean;
  reference: `0x${string}`;
};

/** Reads the IntentCreated Anchor event from a Solana devnet burn tx. */
async function readSolanaIntent(signature: string): Promise<Intent | null> {
  const res = await fetch(SOLANA_CORRIDOR.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: [
        signature,
        { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" },
      ],
    }),
    cache: "no-store",
  });
  const data = (await res.json()) as {
    result?: { meta?: { logMessages?: string[]; err?: unknown } };
  };
  const meta = data.result?.meta;
  if (!meta || meta.err) return null;

  for (const log of meta.logMessages ?? []) {
    if (!log.startsWith("Program data: ")) continue;
    const buf = Buffer.from(log.slice("Program data: ".length), "base64");
    // 8-byte event discriminator + sender(32) + recipient(20) + amount(u64 LE)
    // + convert(u8) + reference(32)
    if (buf.length < 8 + 32 + 20 + 8 + 1 + 32) continue;
    if (!SOLANA_INTENT_EVENT_DISC.every((b, i) => buf[i] === b)) continue;
    const recipient = `0x${buf.subarray(40, 60).toString("hex")}` as `0x${string}`;
    const amount = buf.readBigUInt64LE(60);
    const convertToLocal = buf[68] === 1;
    const reference = `0x${buf.subarray(69, 101).toString("hex")}` as `0x${string}`;
    return { hubRecipient: recipient, amount, convertToLocal, reference };
  }
  return null;
}

/**
 * CCTP relayer (Engineering Spec §3.5 "Relayer / orchestrator"): given a
 * spoke burn tx, reads the intent, waits for Circle's attestation, finalizes
 * the mint on the hub, and processes the deposit (wrap + optional
 * auto-convert to cNGN) — one call takes a deposit from spoke to delivered.
 */
export async function POST(request: Request) {
  // User-facing (Add money), so no operator bearer — but each request can
  // hold a serverless slot ~36s polling IRIS and spends operator gas, so
  // rate-limit hard. Recipients come from the on-chain intent, not the
  // caller, so funds can't be redirected regardless.
  const limited = rateLimit(request, "relay", 6, 60_000);
  if (limited) return limited;

  const pk = process.env.SETTLE_OPERATOR_PK;
  if (!pk) {
    return NextResponse.json(
      { ok: false, error: "Relayer is not enabled on this deployment." },
      { status: 501 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data." },
      { status: 400 },
    );
  }
  const isSolana = parsed.data.chainId === SOLANA_CHAIN_ID;
  const corridor = isSolana ? undefined : CORRIDORS[parsed.data.chainId];
  if (!isSolana && !corridor) {
    return NextResponse.json(
      { ok: false, error: "Unsupported corridor chain." },
      { status: 400 },
    );
  }
  const txHash = parsed.data.txHash;
  const domain = isSolana ? SOLANA_CORRIDOR.domain : corridor!.domain;
  const label = isSolana ? SOLANA_CORRIDOR.label : corridor!.label;

  try {
    // 1. Read the intent from the burn tx on the spoke.
    let intent: Intent;
    if (isSolana) {
      const parsedIntent = await readSolanaIntent(txHash);
      if (!parsedIntent) {
        return NextResponse.json(
          { ok: false, error: "No gateway intent found in that transaction." },
          { status: 400 },
        );
      }
      intent = parsedIntent;
    } else {
      const spoke = createPublicClient({
        chain: corridor!.chain,
        transport: http(corridor!.rpcUrl),
      });
      const receipt = await spoke.getTransactionReceipt({
        hash: txHash as `0x${string}`,
      });
      const intents = parseEventLogs({
        abi: spokeGatewayAbi,
        eventName: "IntentCreated",
        logs: receipt.logs.filter(
          (l) => l.address.toLowerCase() === corridor!.gateway.toLowerCase(),
        ),
      });
      if (intents.length === 0) {
        return NextResponse.json(
          { ok: false, error: "No gateway intent found in that transaction." },
          { status: 400 },
        );
      }
      const args = intents[0].args as {
        hubRecipient: `0x${string}`;
        amount: bigint;
        convertToLocal: boolean;
        reference_: `0x${string}`;
      };
      intent = {
        hubRecipient: args.hubRecipient,
        amount: args.amount,
        convertToLocal: args.convertToLocal,
        reference: args.reference_,
      };
    }

    // 2. Wait for Circle's attestation (fast transfers land in seconds).
    let message: string | undefined;
    let attestation: string | undefined;
    for (let i = 0; i < 12; i++) {
      const res = await fetch(
        `${IRIS_API}/v2/messages/${domain}?transactionHash=${txHash}`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          messages?: { status: string; message: string; attestation: string }[];
        };
        const m = data.messages?.[0];
        if (m?.status === "complete") {
          message = m.message;
          attestation = m.attestation;
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    if (!message || !attestation) {
      return NextResponse.json(
        {
          ok: false,
          error: "Attestation not ready yet — try again in ~30s.",
          retryable: true,
        },
        { status: 202 },
      );
    }

    // 3. Finalize the mint + process the deposit on the hub.
    const transport = http(hubRpcUrl());
    const hub = createPublicClient({ chain: HUB_CHAIN, transport });
    const account = privateKeyToAccount(
      (pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`,
    );
    const wallet = createWalletClient({ account, chain: HUB_CHAIN, transport });

    let mintTx: `0x${string}` | undefined;
    try {
      mintTx = await wallet.writeContract({
        address: MESSAGE_TRANSMITTER,
        abi: messageTransmitterAbi,
        functionName: "receiveMessage",
        args: [message as `0x${string}`, attestation as `0x${string}`],
      });
      await hub.waitForTransactionReceipt({ hash: mintTx, timeout: 30_000 });
    } catch {
      // Nonce already used — someone (or a retry) minted it already. Fine.
    }

    // 4. Credit the recipient. Cap at what's actually sitting unprocessed so
    //    Circle's fast fee (deducted from the mint) never over-credits.
    const reserve = (await hub.readContract({
      address: HUB_BRIDGE_RECEIVER,
      abi: bridgeReceiverAbi,
      functionName: "unprocessedReserve6",
    })) as bigint;
    const amount6 = intent.amount < reserve ? intent.amount : reserve;
    if (amount6 === 0n) {
      return NextResponse.json(
        { ok: false, error: "Deposit already processed.", mintTx },
        { status: 409 },
      );
    }

    const processTx = await wallet.writeContract({
      address: HUB_BRIDGE_RECEIVER,
      abi: bridgeReceiverAbi,
      functionName: "processDeposit",
      args: [
        domain,
        intent.hubRecipient,
        amount6,
        intent.convertToLocal,
        0n,
        intent.reference,
      ],
    });
    await hub.waitForTransactionReceipt({ hash: processTx, timeout: 30_000 });

    return NextResponse.json({
      ok: true,
      corridor: label,
      recipient: intent.hubRecipient,
      amountUsdc: Number(amount6) / 1e6,
      converted: intent.convertToLocal,
      mintTx,
      processTx,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message.slice(0, 200) : "Relay failed.",
      },
      { status: 500 },
    );
  }
}
