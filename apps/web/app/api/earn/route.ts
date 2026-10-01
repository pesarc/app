import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccount } from "@pesarc/sdk/api/auth";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { listPositions, deposit, withdraw } from "@pesarc/sdk/earn-positions";
import { findPool } from "@pesarc/sdk/earn";
import { autoAllocateOnDeposit } from "@/lib/vaultAllocate";

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
  // The chain the on-chain deposit landed on, so we can put the new idle to work
  // (event-driven allocation) instead of waiting for a cron tick.
  chainKey: z.string().min(1).max(40).optional(),
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
  // Event-driven allocation: a fresh deposit means new idle to deploy. Fire it
  // (debounced, opt-in via AUTO_ALLOCATE) without blocking the deposit response.
  if (parsed.data.chainKey) void autoAllocateOnDeposit(parsed.data.chainKey);
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
