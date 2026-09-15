import { NextResponse } from "next/server";
import { z } from "zod";
import { createPayout, getPayout } from "@pesarc/sdk/payouts";
import { getAccount } from "@pesarc/sdk/api/auth";
import { rateLimit } from "@pesarc/sdk/api/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  reference: z.string().trim().min(1).max(40),
  beneficiary: z.string().trim().min(1).max(120),
  method: z.enum(["bank", "mobile_money"]),
  amountNgn: z.number().positive(),
  txHash: z.string().trim().max(80).optional(),
});

/** Creates a fiat payout (sandbox ramp partner), owned by the caller. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "payouts-write", 20, 60_000);
  if (limited) return limited;

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
  const payout = await createPayout(parsed.data, await getAccount(request));
  return NextResponse.json({ ok: true, payout });
}

/**
 * GET ?ref=… — payout status, **scoped to the caller's account**. A reference
 * alone is not authorisation: guessing one only ever reads your own payouts.
 */
export async function GET(request: Request) {
  const limited = rateLimit(request, "payouts-read", 60, 60_000);
  if (limited) return limited;

  const ref = new URL(request.url).searchParams.get("ref");
  if (!ref) {
    return NextResponse.json({ ok: false, error: "Missing ref." }, { status: 400 });
  }
  const payout = await getPayout(ref, await getAccount(request));
  if (!payout) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, payout });
}
