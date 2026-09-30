import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Paystack redirects here after a checkout (card top-up). Verifies the transaction
// server-side, then bounces the user back into the app with a status. Same route
// for test and live — it uses the matching secret key.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference") || url.searchParams.get("trxref");
  const secret = process.env.PAYSTACK_SECRET_KEY;

  let status: "success" | "failed" | "unknown" = "unknown";
  if (reference && secret) {
    try {
      const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const j = (await res.json()) as { status?: boolean; data?: { status?: string } };
      status = j.status && j.data?.status === "success" ? "success" : "failed";
    } catch {
      status = "unknown";
    }
  }

  return NextResponse.redirect(new URL(`/add?topup=${status}`, request.url));
}
