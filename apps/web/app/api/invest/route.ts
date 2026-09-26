import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccount } from "@pesarc/sdk/api/auth";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { getBroker } from "@pesarc/sdk/broker";
import { listHoldings, applyBuy, applySell } from "@pesarc/sdk/holdings";
import { instrumentBySymbol } from "@pesarc/sdk/invest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The caller's durable holdings, plus whether prices are live. */
export async function GET(request: Request) {
  const limited = rateLimit(request, "invest-read", 60, 60_000);
  if (limited) return limited;
  const holdings = await listHoldings(await getAccount(request));
  return NextResponse.json({ ok: true, holdings, live: getBroker().live });
}

const orderSchema = z.object({
  symbol: z.string().trim().min(1).max(24),
  shares: z.number().positive().max(1_000_000),
  side: z.enum(["buy", "sell"]),
});

/** Place an order through the broker, then persist the resulting holding. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "invest-write", 30, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data." },
      { status: 400 },
    );
  }
  const { symbol, shares, side } = parsed.data;
  if (!instrumentBySymbol(symbol)) {
    return NextResponse.json({ ok: false, error: "Unknown symbol." }, { status: 400 });
  }

  const broker = getBroker();
  const result = await broker.placeOrder({ symbol, shares, side });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "Order failed." }, { status: 502 });
  }

  const account = await getAccount(request);
  const filledPrice = result.filledPrice ?? 0;
  const holding =
    side === "buy"
      ? await applyBuy(account, symbol, shares, filledPrice)
      : await applySell(account, symbol, shares);

  return NextResponse.json({
    ok: true,
    order: { orderId: result.orderId, symbol, shares, side, filledPrice },
    holding,
    live: broker.live,
  });
}
