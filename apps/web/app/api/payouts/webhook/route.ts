import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mapProviderStatus } from "@pesarc/sdk/ramp";
import { updatePayoutStatus } from "@pesarc/sdk/payouts";

// Multi-provider off-ramp webhook. A payout partner POSTs status updates here
// (accepted → processing → paid / failed). The caller is identified by its
// signature header, verified with that provider's scheme, then the stored payout
// — keyed by the partner's reference — is updated. Source of truth for payouts.
//
//  • paystack   — HMAC-SHA512 of the raw body keyed with PAYSTACK_SECRET_KEY,
//    header x-paystack-signature; body { event: "transfer.*", data: {...} }.
//  • flutterwave— static `verif-hash` header == FLUTTERWAVE_WEBHOOK_HASH;
//    body { event: "transfer.*", data: { id, reference, status } }.
//  • generic    — HMAC-SHA256 keyed with RAMP_WEBHOOK_SECRET, header
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

function constEquals(a: string | null, b: string): boolean {
  if (!a) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
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

async function handleFlutterwave(request: Request, raw: string) {
  const secret = process.env.FLUTTERWAVE_WEBHOOK_HASH;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "webhook not configured" }, { status: 503 });
  }
  // Flutterwave sends a static shared secret in `verif-hash` (not an HMAC).
  if (!constEquals(request.headers.get("verif-hash"), secret)) {
    return NextResponse.json({ ok: false, error: "bad signature" }, { status: 401 });
  }
  let body: { event?: string; data?: { id?: number | string; reference?: string; status?: string } };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }
  if (!body.event?.startsWith("transfer")) {
    return NextResponse.json({ ok: true, ignored: body.event ?? null });
  }
  const partnerRef = body.data?.id != null ? String(body.data.id) : body.data?.reference;
  if (!partnerRef) {
    return NextResponse.json({ ok: false, error: "missing partner reference" }, { status: 400 });
  }
  const status = mapProviderStatus(body.data?.status);
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
  // Identify the caller by its signature header, then verify with that scheme.
  if (request.headers.get("x-paystack-signature")) return handlePaystack(request, raw);
  if (request.headers.get("verif-hash")) return handleFlutterwave(request, raw);
  return handleGeneric(request, raw);
}
