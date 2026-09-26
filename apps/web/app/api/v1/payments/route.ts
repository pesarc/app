import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiKey, isApiError } from "@pesarc/sdk/api/developer";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { storeRateLimit, recordUsage } from "@pesarc/sdk/api/rate-limit-store";
import { createPayment, listPayments, publicPayment } from "@pesarc/sdk/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  amount: z.number().positive().max(1_000_000_000),
  currency: z.string().trim().min(2).max(8),
  reference: z.string().trim().max(64).optional(),
  merchant_name: z.string().trim().max(80).optional(),
  description: z.string().trim().max(300).optional(),
  redirect_url: z.string().trim().url().max(2000),
  webhook_url: z.string().trim().url().max(2000).optional(),
  payout_address: z
    .string()
    .trim()
    .regex(/^0x[0-9a-fA-F]{40}$/, "payout_address must be a 0x EVM address")
    .optional(),
  metadata: z.record(z.unknown()).optional(),
  ttl_minutes: z.number().int().min(1).max(1440).optional(),
});

/** Create a payment session; returns a hosted checkout_url to send the customer to. */
export async function POST(request: Request) {
  const floor = rateLimit(request, "v1-payments-write", 60, 60_000);
  if (floor) return floor;

  const ctx = await requireApiKey(request);
  if (isApiError(ctx)) return ctx;

  const limited = await storeRateLimit(`v1-write:${ctx.keyId}`, 120, 60_000);
  if (limited) return limited;
  recordUsage(ctx.account, ctx.keyId);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { type: "invalid_request_error", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { type: "invalid_request_error", message: parsed.error.issues[0]?.message ?? "Invalid request." } },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const payment = await createPayment({
    account: ctx.account,
    apiKeyId: ctx.keyId,
    amount: d.amount,
    currency: d.currency,
    reference: d.reference,
    merchantName: d.merchant_name,
    description: d.description,
    redirectUrl: d.redirect_url,
    webhookUrl: d.webhook_url,
    payoutAddress: d.payout_address,
    metadata: d.metadata,
    ttlMinutes: d.ttl_minutes,
  });

  return NextResponse.json(publicPayment(payment, new URL(request.url).origin), { status: 201 });
}

/** List the merchant's payment sessions, newest first. */
export async function GET(request: Request) {
  const floor = rateLimit(request, "v1-payments-read", 120, 60_000);
  if (floor) return floor;

  const ctx = await requireApiKey(request);
  if (isApiError(ctx)) return ctx;

  const limited = await storeRateLimit(`v1:${ctx.keyId}`, 300, 60_000);
  if (limited) return limited;
  recordUsage(ctx.account, ctx.keyId);

  const origin = new URL(request.url).origin;
  const payments = await listPayments(ctx.account);
  return NextResponse.json({ object: "list", data: payments.map((p) => publicPayment(p, origin)) });
}
