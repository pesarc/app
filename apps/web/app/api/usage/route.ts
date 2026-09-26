import { NextResponse } from "next/server";
import { getAccount } from "@pesarc/sdk/api/auth";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { getUsageToday } from "@pesarc/sdk/api/rate-limit-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Today's developer-API call count for the caller's account. */
export async function GET(request: Request) {
  const limited = rateLimit(request, "usage-read", 60, 60_000);
  if (limited) return limited;
  const today = await getUsageToday(await getAccount(request));
  return NextResponse.json({ ok: true, today });
}
