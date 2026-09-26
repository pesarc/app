import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccount } from "@pesarc/sdk/api/auth";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { listPositions, deposit, withdraw } from "@pesarc/sdk/earn-positions";
import { findPool } from "@pesarc/sdk/earn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The caller's durable earn positions. */
export async function GET(request: Request) {
  const limited = rateLimit(request, "earn-read", 60, 60_000);
  if (limited) return limited;
  const positions = await listPositions(await getAccount(request));
  return NextResponse.json({ ok: true, positions });
}

const depositSchema = z.object({
  poolId: z.string().trim().min(1).max(60),
  amount: z.number().positive().max(1_000_000_000),
});

/** Deposit into a pool (adds to any existing position). */
export async function POST(request: Request) {
  const limited = rateLimit(request, "earn-write", 30, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }
  const parsed = depositSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data." },
      { status: 400 },
    );
  }
  if (!findPool(parsed.data.poolId)) {
    return NextResponse.json({ ok: false, error: "Unknown pool." }, { status: 400 });
  }
  const principal = await deposit(await getAccount(request), parsed.data.poolId, parsed.data.amount);
  return NextResponse.json({ ok: true, poolId: parsed.data.poolId, principal });
}

/** Withdraw a position in full (funds are never frozen). */
export async function DELETE(request: Request) {
  const limited = rateLimit(request, "earn-write", 30, 60_000);
  if (limited) return limited;
  const poolId = new URL(request.url).searchParams.get("poolId") ?? "";
  if (!poolId) return NextResponse.json({ ok: false, error: "Missing poolId." }, { status: 400 });
  const ok = await withdraw(await getAccount(request), poolId);
  return NextResponse.json({ ok });
}
