import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mapProviderStatus, rampProvider } from "@pesarc/sdk/ramp";
import { updatePayoutStatus } from "@pesarc/sdk/payouts";

// Off-ramp provider webhook. A licensed payout partner POSTs status updates here
// (accepted → processing → paid / failed). The body is verified against the
// active provider's signing scheme, then the stored payout — keyed by the
// partner's reference — is updated. This is the source of truth for real payouts.
//
//  • paystack — HMAC-SHA512 of the raw body keyed with PAYSTACK_SECRET_KEY,
//    header x-paystack-signature; body { event: "transfer.*", data: {...} }.
//  • generic  — HMAC-SHA256 keyed with RAMP_WEBHOOK_SECRET, header
//    x-ramp-signature (or x-webhook-signature).

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

async function handlePaystack(request: Request, raw: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "webhook not configured" }, { status: 503 });
  }
  const signature = request.headers.get("x-paystack-signature");
  if (!hmacEquals("sha512", raw, signature, secret)) {
    return NextResponse.json({ ok: false, error: "bad signature" }, { status: 401 });
  }
  let body: { event?: string; data?: { transfer_code?: string; reference?: string; status?: string } };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }
  // Only transfer (payout) events touch payouts; ignore collections etc.
  if (!body.event?.startsWith("transfer.")) {
    return NextResponse.json({ ok: true, ignored: body.event ?? null });
  }
  const partnerRef = body.data?.transfer_code ?? body.data?.reference;
  if (!partnerRef) {
    return NextResponse.json({ ok: false, error: "missing partner reference" }, { status: 400 });
  }
  // Prefer data.status; fall back to the event suffix (transfer.success → success).
  const status = mapProviderStatus(body.data?.status ?? body.event.split(".")[1]);
  const updated = await updatePayoutStatus(String(partnerRef), status);
  return NextResponse.json({ ok: true, updated, status });
}

async function handleGeneric(request: Request, raw: string) {
  const secret = process.env.RAMP_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "webhook not configured" }, { status: 503 });
  }
  const signature =
    request.headers.get("x-ramp-signature") ?? request.headers.get("x-webhook-signature");
  if (!hmacEquals("sha256", raw, signature, secret)) {
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

export async function POST(request: Request) {
  const raw = await request.text();
  return rampProvider() === "paystack"
    ? handlePaystack(request, raw)
    : handleGeneric(request, raw);
}
