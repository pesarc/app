import { NextResponse } from "next/server";
import { requireApiKey, isApiError } from "@pesarc/sdk/api/developer";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { storeRateLimit, recordUsage } from "@pesarc/sdk/api/rate-limit-store";
import { getPayment, publicPayment } from "@pesarc/sdk/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Retrieve one payment session the caller's account owns. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const floor = rateLimit(request, "v1-payment-read", 120, 60_000);
  if (floor) return floor;

  const ctx = await requireApiKey(request);
  if (isApiError(ctx)) return ctx;

  const limited = await storeRateLimit(`v1:${ctx.keyId}`, 300, 60_000);
  if (limited) return limited;
  recordUsage(ctx.account, ctx.keyId);

  const { id } = await params;
  const payment = await getPayment(id);
  // 404 for both missing and other-account sessions — never leak existence.
  if (!payment || payment.account !== ctx.account) {
    return NextResponse.json(
      { error: { type: "not_found", message: "No such payment." } },
      { status: 404 },
    );
  }
  return NextResponse.json(publicPayment(payment, new URL(request.url).origin));
}
