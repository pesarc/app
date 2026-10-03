import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  getCollection,
  claimCollectionCredit,
  setCollectionCreditTx,
  updateCollectionStatus,
} from "@pesarc/sdk/collections-store";
import { creditTopUp } from "@pesarc/sdk/collections-credit";

// Collection (pay-in) webhook. The bank partner POSTs collection/checkout
// events here; on a successful collection we CREDIT the wallet on-chain. Kept
// separate from the payouts webhook so the pay-in side (which mints) never
// shares a code path with the payout side.
//
// Verification (confirmed against the partner's docs): HMAC-SHA256, two schemes —
//   • X-Bachs-Signature-V2 (preferred): hex( HMAC(secret, "{ts}.{raw}") ),
//     with the Unix-seconds timestamp in X-Bachs-Timestamp (±5 min tolerance);
//   • X-Bachs-Signature (legacy): hex( HMAC(secret, raw) ).
// Secret: BACHS_WEBHOOK_SECRET. Source of truth for fulfilment is the
// collection.succeeded event; checkout.completed is treated the same way.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOLERANCE_S = 300;

function hexEquals(expected: string, got: string | null): boolean {
  if (!got) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got.replace(/^sha256=/, ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

function verify(request: Request, raw: string, secret: string): boolean {
  const v2 = request.headers.get("x-bachs-signature-v2");
  const ts = request.headers.get("x-bachs-timestamp");
  if (v2 && ts) {
    const n = Number(ts);
    if (!Number.isFinite(n) || Math.abs(Date.now() / 1000 - n) > TOLERANCE_S) return false;
    const expected = createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex");
    return hexEquals(expected, v2);
  }
  const legacy = request.headers.get("x-bachs-signature");
  if (legacy) {
    const expected = createHmac("sha256", secret).update(raw).digest("hex");
    return hexEquals(expected, legacy);
  }
  return false;
}

// collection.succeeded is the partner's documented source of truth for
// fulfilment (funds captured) — the ONLY event we credit on. checkout.completed
// can fire before capture, so it is acked but never credits.
const CREDIT_EVENT = "collection.succeeded";
const FAIL_EVENTS = new Set(["collection.failed", "checkout.expired"]);

export async function POST(request: Request) {
  const raw = await request.text();
  // Allow a collections-specific secret when the partner uses a separate webhook
  // endpoint (its own whsec_), else the shared one.
  const secret = process.env.BACHS_COLLECTIONS_WEBHOOK_SECRET || process.env.BACHS_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "webhook not configured" }, { status: 503 });
  }
  if (!verify(request, raw, secret)) {
    return NextResponse.json({ ok: false, error: "bad signature" }, { status: 401 });
  }

  let body: { type?: string; data?: { checkout_id?: string; reference?: string; status?: string } };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  const type = body.type ?? "";
  const sessionId = body.data?.checkout_id ?? "";
  const reference = body.data?.reference;

  if (type !== CREDIT_EVENT && !FAIL_EVENTS.has(type)) {
    return NextResponse.json({ ok: true, ignored: type || null });
  }
  if (!sessionId && !reference) {
    return NextResponse.json({ ok: false, error: "missing session reference" }, { status: 400 });
  }

  const row = await getCollection(sessionId, reference);
  if (!row) {
    // Not one of ours (another integration on the same endpoint) — ack so the
    // partner doesn't retry forever.
    return NextResponse.json({ ok: true, unmatched: true });
  }

  if (FAIL_EVENTS.has(type)) {
    const changed = await updateCollectionStatus(row.sessionId, type.endsWith("expired") ? "expired" : "failed");
    return NextResponse.json({ ok: true, updated: changed });
  }

  // Success: claim the credit exactly once, THEN mint. A duplicate/retry webhook
  // loses the claim and is acked without crediting again.
  const claimed = await claimCollectionCredit(row.sessionId);
  if (!claimed) {
    return NextResponse.json({ ok: true, alreadyCredited: true });
  }

  const credit = await creditTopUp({
    address: claimed.address,
    amount: claimed.amount,
    currency: claimed.currency,
    chainKey: claimed.chainKey,
  });

  if (credit.ok && credit.tx) {
    await setCollectionCreditTx(claimed.sessionId, credit.tx, credit.chainKey);
    return NextResponse.json({ ok: true, credited: true, tx: credit.tx });
  }

  // Marked paid, but the on-chain credit couldn't run (e.g. no operator key /
  // no testnet token on this host). Surface it in logs; the row stays paid so a
  // retry won't double-credit, and the founder can reconcile.
  console.warn(`[collections:webhook] credit skipped for ${claimed.sessionId}: ${credit.reason}`);
  return NextResponse.json({ ok: true, credited: false, reason: credit.reason });
}
