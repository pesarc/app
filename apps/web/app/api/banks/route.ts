import { NextResponse } from "next/server";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { listBanks } from "@pesarc/sdk/banks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bank list for the withdraw/payout picker. Live from Paystack when configured,
 *  else a curated Nigerian bank list so the flow works in demo. */
export async function GET(request: Request) {
  const limited = rateLimit(request, "banks-read", 60, 60_000);
  if (limited) return limited;
  const currency = new URL(request.url).searchParams.get("currency") ?? "NGN";
  const banks = await listBanks(currency);
  return NextResponse.json({ ok: true, banks });
}
