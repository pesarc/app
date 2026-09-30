import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { resolveBankAccountByRef } from "@pesarc/sdk/bank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Paystack webhook. Verifies the HMAC-SHA512 signature (x-paystack-signature)
// over the RAW body with the secret key, then handles events. Same route works
// for test and live — Paystack signs with the matching secret. Always 200s fast.
export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const raw = await request.text();

  if (secret) {
    const expected = createHmac("sha512", secret).update(raw).digest("hex");
    const got = request.headers.get("x-paystack-signature") ?? "";
    if (got !== expected) {
      return NextResponse.json({ ok: false, error: "bad signature" }, { status: 401 });
    }
  }

  let evt: {
    event?: string;
    data?: {
      customer?: { email?: string };
      dedicated_account?: {
        account_number?: string;
        account_name?: string;
        bank?: { name?: string };
      };
    };
  };
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true }); // ack malformed, don't retry-storm
  }

  if (evt.event === "dedicatedaccount.assign.success") {
    const email = evt.data?.customer?.email;
    const dva = evt.data?.dedicated_account;
    if (email && dva?.account_number) {
      await resolveBankAccountByRef(email, {
        accountNumber: dva.account_number,
        bankName: dva.bank?.name || "Bank",
        accountName: dva.account_name || "Pesarc Wallet",
      }).catch(() => {});
    }
  }
  // Other events (charge.success on a DVA top-up, etc.) are acknowledged for now.

  return NextResponse.json({ ok: true });
}
