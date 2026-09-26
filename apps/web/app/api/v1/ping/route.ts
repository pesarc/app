import { NextResponse } from "next/server";
import { requireApiKey, isApiError } from "@pesarc/sdk/api/developer";
import { rateLimit } from "@pesarc/sdk/api/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Auth smoke test for developers: confirms the key works and echoes the account. */
export async function GET(request: Request) {
  const limited = rateLimit(request, "v1-ping", 120, 60_000);
  if (limited) return limited;

  const ctx = await requireApiKey(request);
  if (isApiError(ctx)) return ctx;

  return NextResponse.json({ ok: true, account: ctx.account, live: true });
}
