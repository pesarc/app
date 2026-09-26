import { NextResponse } from "next/server";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { getPayment } from "@pesarc/sdk/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Safe, display-only view of a payment for the hosted checkout page. Does not
 * expose the merchant account, redirect_url or any signing material — the
 * customer only needs to see who and how much.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, "checkout-read", 120, 60_000);
  if (limited) return limited;

  const { id } = await params;
  const payment = await getPayment(id);
  if (!payment) {
    return NextResponse.json({ ok: false, error: "No such payment." }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    payment: {
      id: payment.id,
      merchantName: payment.merchantName,
      description: payment.description ?? null,
      amount: payment.amount,
      currency: payment.currency,
      reference: payment.reference,
      status: payment.status,
      hasPayout: Boolean(payment.payoutAddress),
      expiresAt: payment.expiresAt,
    },
  });
}
