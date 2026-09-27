import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mapCngnStatus } from "@pesarc/sdk/cngn";
import { updatePayoutStatus } from "@pesarc/sdk/payouts";
import { updateVirtualAccountStatus } from "@pesarc/sdk/virtualAccounts";

// cNGN status callbacks. cNGN POSTs deposit + redemption/withdraw updates here;
// we verify the caller, then update the matching record — source of truth for
// the fiat legs, mirroring /api/payouts/webhook.
//
//  • Deposit (NGN → cNGN into a virtual account) → update the virtual account,
//    keyed by its `reference`.
//  • Redemption / withdraw (cNGN → NGN / on-chain) → update the payout, keyed by
//    the transaction ref (`trxRef` / `trx_ref`), which is the payout partnerRef.
//
// NOTE: cNGN's public docs don't pin down the webhook signature scheme, so we
// verify an HMAC-SHA256 (or SHA512) of the raw body against CNGN_WEBHOOK_SECRET
// (header `x-cngn-signature`, falling back to `x-webhook-signature`) — the same
// shape as our generic ramp webhook. Confirm the exact header/algorithm in the
// cNGN dashboard before going live; until CNGN_WEBHOOK_SECRET is set this
// endpoint returns 503 (disabled), so nothing breaks.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hmacEquals(
  algo: "sha256" | "sha512",
  raw: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac(algo, secret).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.replace(/^sha(256|512)=/, ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

type CngnWebhookBody = {
  event?: string;
  type?: string;
  data?: {
    reference?: string;
    paymentReference?: string;
    trxRef?: string;
    trx_ref?: string;
    trx_type?: string;
    status?: string;
  };
};

export async function POST(request: Request) {
  const raw = await request.text();
  const secret = process.env.CNGN_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "webhook not configured" }, { status: 503 });
  }

  const signature =
    request.headers.get("x-cngn-signature") ?? request.headers.get("x-webhook-signature");
  // Accept either HMAC variant so the exact algorithm can be set dashboard-side.
  if (
    !hmacEquals("sha256", raw, signature, secret) &&
    !hmacEquals("sha512", raw, signature, secret)
  ) {
    return NextResponse.json({ ok: false, error: "bad signature" }, { status: 401 });
  }

  let body: CngnWebhookBody;
  try {
    body = JSON.parse(raw) as CngnWebhookBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  const data = body.data ?? {};
  const status = mapCngnStatus(data.status);
  const kind = (body.event ?? body.type ?? data.trx_type ?? "").toLowerCase();

  // A deposit / virtual-account credit updates the virtual account; anything
  // else (redeem / withdraw) updates the payout. If the hint is ambiguous, try
  // the payout first and fall back to the virtual account.
  const isDeposit = kind.includes("deposit") || kind.includes("virtual") || kind.includes("fiat_buy");

  if (isDeposit) {
    const reference = data.reference ?? data.paymentReference;
    if (!reference) {
      return NextResponse.json({ ok: false, error: "missing reference" }, { status: 400 });
    }
    const updated = await updateVirtualAccountStatus(reference, status);
    return NextResponse.json({ ok: true, target: "virtual_account", updated, status });
  }

  const partnerRef = data.trxRef ?? data.trx_ref ?? data.reference;
  if (!partnerRef) {
    return NextResponse.json({ ok: false, error: "missing reference" }, { status: 400 });
  }
  let updated = await updatePayoutStatus(partnerRef, status);
  let target = "payout";
  if (!updated) {
    // Not a known payout — it may be a deposit whose event we couldn't classify.
    const ref = data.reference ?? data.paymentReference ?? partnerRef;
    updated = await updateVirtualAccountStatus(ref, status);
    target = "virtual_account";
  }
  return NextResponse.json({ ok: true, target, updated, status });
}
