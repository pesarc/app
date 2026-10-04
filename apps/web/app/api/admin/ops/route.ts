import { NextResponse } from "next/server";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { listAllPayouts, type PayoutRow } from "@pesarc/sdk/payouts";
import { listAllTransfers, type TransferRow } from "@pesarc/sdk/transfers";
import { availableAdapters, rampIsLive } from "@pesarc/sdk/ramp";
import { FEE_PCT } from "@pesarc/sdk/quote";
import { escrowUsdcBalances } from "@pesarc/sdk/treasury";
import { bachsBalances, bachsConfigured } from "@pesarc/sdk/bachs";

// Live operations snapshot for the internal admin dashboard: recent payouts
// across ALL accounts, recent transfers, computed KPIs, and provider health.
// Gated by ADMIN_SECRET (same gate as /api/admin/catalog) and rate-limited —
// listAllPayouts/listAllTransfers are NOT account-scoped, so this must never be
// reachable without the secret when one is set.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function forbidden(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return request.headers.get("x-admin-secret") !== secret;
}

function metrics(payouts: PayoutRow[], transfers: TransferRow[]) {
  let paidNgn = 0;
  let pending = 0;
  let failed = 0;
  for (const p of payouts) {
    if (p.status === "paid") paidNgn += p.amountNgn;
    else if (p.status === "failed") failed += 1;
    else pending += 1; // initiated | processing
  }
  // Est. fee revenue = amount × FEE_PCT per transfer, grouped by send currency
  // (summing mixed currencies into one number would be misleading).
  const byCurrency = new Map<string, number>();
  for (const t of transfers) {
    const fee = t.sendAmount * FEE_PCT;
    byCurrency.set(t.sendCurrency, (byCurrency.get(t.sendCurrency) ?? 0) + fee);
  }
  const fees = [...byCurrency.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => b.amount - a.amount);
  return {
    totalPayouts: payouts.length,
    paidNgn,
    pending,
    failed,
    totalTransfers: transfers.length,
    feePct: FEE_PCT,
    fees,
  };
}

export async function GET(request: Request) {
  const limited = rateLimit(request, "admin-read", 60, 60_000);
  if (limited) return limited;
  if (forbidden(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const [payouts, transfers, escrow, float] = await Promise.all([
    listAllPayouts(50),
    listAllTransfers(50),
    escrowUsdcBalances(),
    bachsConfigured() ? bachsBalances() : Promise.resolve(null),
  ]);

  const escrowUsdcTotal = escrow.reduce((s, e) => s + e.usdc, 0);
  const floatNgn = float?.find((b) => b.currency === "NGN")?.available ?? null;

  const providers = availableAdapters().map((a) => ({
    name: a.name,
    // "live" here = a configured real partner (vs the universal simulator
    // fallback). No partner API is probed from this read-only snapshot.
    live: a.name !== "simulated",
    countries: a.countries ?? null,
    pollable: Boolean(a.pollable),
  }));

  return NextResponse.json({
    ok: true,
    metrics: metrics(payouts, transfers),
    payouts,
    transfers,
    providers,
    rampLive: rampIsLive(),
    treasury: {
      escrowUsdcTotal,
      escrowByChain: escrow,
      floatProvider: bachsConfigured() ? "bachs" : null,
      floatNgn,
      float,
    },
  });
}
