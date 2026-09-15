import { NextResponse } from "next/server";
import { Connection, Keypair, Transaction, PublicKey } from "@solana/web3.js";
import { rateLimit } from "@pesarc/sdk/api/guard";

// Solana gasless: the fee-payer relayer co-signs a user-signed tx and submits
// it, so the user pays 0 SOL. Sponsors ONLY transactions where the relayer is
// the fee payer and every instruction targets an allow-listed program (our
// prediction market + the token/system programs it needs) — so the relayer's
// SOL can't be drained by arbitrary transactions.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ATOKEN = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const SYSTEM = "11111111111111111111111111111111";
const COMPUTE = "ComputeBudget111111111111111111111111111111";

function relayer(): Keypair | null {
  const s = process.env.SVM_FEE_PAYER_SECRET;
  if (!s) return null;
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(s)));
  } catch {
    return null;
  }
}

function rpcUrl(): string {
  if (process.env.NEXT_PUBLIC_SVM_RPC_URL) return process.env.NEXT_PUBLIC_SVM_RPC_URL;
  const c = process.env.NEXT_PUBLIC_SVM_CLUSTER || "devnet";
  if (c === "mainnet-beta") return "https://api.mainnet-beta.solana.com";
  if (c === "testnet") return "https://api.testnet.solana.com";
  return "https://api.devnet.solana.com";
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "svm-sponsor", 20, 60_000);
  if (limited) return limited;

  const kp = relayer();
  if (!kp) return NextResponse.json({ error: "sponsor not configured" }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const b64 = (body as { tx?: string })?.tx;
  if (typeof b64 !== "string") return NextResponse.json({ error: "missing tx" }, { status: 400 });

  let tx: Transaction;
  try {
    tx = Transaction.from(Buffer.from(b64, "base64"));
  } catch {
    return NextResponse.json({ error: "malformed tx" }, { status: 400 });
  }

  // The relayer must be the fee payer (it's who pays), never a signer being drained elsewhere.
  if (!tx.feePayer?.equals(kp.publicKey)) {
    return NextResponse.json({ error: "relayer is not the fee payer" }, { status: 400 });
  }

  const allowed = new Set(
    [process.env.NEXT_PUBLIC_SVM_PREDICTION_MARKET, TOKEN, ATOKEN, SYSTEM, COMPUTE].filter(Boolean),
  );
  const ok = tx.instructions.every((ix) => allowed.has(ix.programId.toBase58()));
  if (!ok) return NextResponse.json({ error: "instruction not allowed" }, { status: 403 });

  try {
    tx.partialSign(kp);
    const conn = new Connection(rpcUrl(), "confirmed");
    const signature = await conn.sendRawTransaction(tx.serialize());
    await conn.confirmTransaction(signature, "confirmed");
    return NextResponse.json({ signature });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "submit failed" },
      { status: 500 },
    );
  }
}
