import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { getAccount } from "@pesarc/sdk/api/auth";
import {
  getPayment,
  markPaid,
  signPayment,
  buildRedirect,
  publicPayment,
} from "@pesarc/sdk/payments";
import { signingSecretFor } from "@pesarc/sdk/apiKeys";
import { deliverWebhook } from "@pesarc/sdk/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  customerLabel: z.string().trim().max(80).optional(),
  txHash: z.string().trim().max(120).optional(),
});

/**
 * Complete a checkout: the in-app customer has paid (real corridor send in live
 * mode, simulated in mock), so mark the session paid and hand back the signed
 * merchant redirect URL for the browser to navigate to.
 *
 * Idempotent: a session only transitions pending -> paid once; a second call
 * returns the same signed redirect.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, "checkout-complete", 40, 60_000);
  if (limited) return limited;

  const { id } = await params;
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    /* empty body is fine */
  }
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }

  const existing = await getPayment(id);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "No such payment." }, { status: 404 });
  }
  if (existing.status === "expired") {
    return NextResponse.json({ ok: false, error: "This payment link has expired." }, { status: 410 });
  }
  if (existing.status === "canceled") {
    return NextResponse.json({ ok: false, error: "This payment was canceled." }, { status: 409 });
  }

  // Scope the recorded customer to the signed-in account when available.
  const account = await getAccount(request);
  const customerLabel =
    parsed.data.customerLabel || (account !== "demo" ? account : undefined);

  const payment = await markPaid(id, { customerLabel, txHash: parsed.data.txHash });
  if (!payment) {
    return NextResponse.json({ ok: false, error: "Could not settle." }, { status: 500 });
  }

  const secret = await signingSecretFor(payment.account, payment.apiKeyId);
  const signature = secret ? signPayment(secret, payment) : "";
  const redirectUrl = buildRedirect(payment, signature);

  // Notify the merchant's webhook, if any. Best-effort and time-boxed so it
  // never delays the customer's redirect; the signed redirect + a GET on the
  // payment remain the reliable signals.
  if (secret && payment.webhookUrl && existing.status === "pending") {
    const origin = new URL(request.url).origin;
    deliverWebhook(payment.webhookUrl, secret, {
      type: "payment.succeeded",
      created: Math.floor(Date.now() / 1000),
      data: publicPayment(payment, origin),
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    status: payment.status,
    reference: payment.reference,
    redirectUrl,
  });
}
