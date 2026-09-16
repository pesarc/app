import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mapProviderStatus } from "@pesarc/sdk/ramp";
import { updatePayoutStatus } from "@pesarc/sdk/payouts";

// Off-ramp provider webhook. A licensed payout partner POSTs status updates here
// (accepted → processing → paid / failed). The body is verified with an HMAC
// signature (RAMP_WEBHOOK_SECRET), then the stored payout — keyed by the
// partner's reference — is updated. This is the source of truth for real payouts.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verify(raw: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.replace(/^sha256=/, ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.RAMP_WEBHOOK_SECRET;
  if (!secret) {
    // No secret configured → no real provider; nothing to accept.
    return NextResponse.json({ ok: false, error: "webhook not configured" }, { status: 503 });
  }

  const raw = await request.text();
  const signature =
    request.headers.get("x-ramp-signature") ?? request.headers.get("x-webhook-signature");
  if (!verify(raw, signature, secret)) {
    return NextResponse.json({ ok: false, error: "bad signature" }, { status: 401 });
  }

  let body: { id?: string; reference?: string; partnerRef?: string; status?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  const partnerRef = body.partnerRef ?? body.id ?? body.reference;
  if (!partnerRef) {
    return NextResponse.json({ ok: false, error: "missing partner reference" }, { status: 400 });
  }

  const status = mapProviderStatus(body.status);
  const updated = await updatePayoutStatus(String(partnerRef), status);
  return NextResponse.json({ ok: true, updated, status });
}
