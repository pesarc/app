import { NextResponse } from "next/server";
import { requireApiKey, isApiError } from "@pesarc/sdk/api/developer";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { storeRateLimit, recordUsage } from "@pesarc/sdk/api/rate-limit-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Auth smoke test for developers: confirms the key works and echoes the account. */
export async function GET(request: Request) {
  const floor = rateLimit(request, "v1-ping", 120, 60_000);
  if (floor) return floor;

  const ctx = await requireApiKey(request);
  if (isApiError(ctx)) return ctx;

  const limited = await storeRateLimit(`v1:${ctx.keyId}`, 300, 60_000);
  if (limited) return limited;
  recordUsage(ctx.account, ctx.keyId);

  return NextResponse.json({ ok: true, account: ctx.account, live: true });
}
