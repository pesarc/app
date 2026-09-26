import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@pesarc/sdk/api/guard";
import {
  sponsorConfigured,
  sponsorAddress,
  poolFee,
  coSignAndSubmit,
} from "@pesarc/sdk/algorand/sponsor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Algorand gasless (fee pooling), in-house. GET returns the sponsor address so
 * the client can build a fee-cover self-payment; POST co-signs that one txn in
 * the group and submits (the user's txns carry fee 0). No third party.
 */
export async function GET() {
  const address = sponsorAddress();
  if (!address) {
    return NextResponse.json({ ok: false, error: "Sponsor not configured." }, { status: 503 });
  }
  // poolFee(n) = the microAlgos the sponsor fee-cover txn must carry for n txns.
  return NextResponse.json({ ok: true, address, feeFor2: poolFee(2), minFee: poolFee(1) });
}

const schema = z.object({ txns: z.array(z.string()).min(1).max(16) });

export async function POST(request: Request) {
  const limited = rateLimit(request, "algo-sponsor", 20, 60_000);
  if (limited) return limited;
  if (!sponsorConfigured()) {
    return NextResponse.json({ ok: false, error: "Sponsor not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Expected { txns: string[] }." }, { status: 400 });
  }

  const result = await coSignAndSubmit(parsed.data.txns);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, txId: result.txId });
}
