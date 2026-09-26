import { NextResponse } from "next/server";
import { getAccount } from "@pesarc/sdk/api/auth";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { revokeApiKey } from "@pesarc/sdk/apiKeys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Revoke one of the caller's keys. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, "keys-revoke", 30, 60_000);
  if (limited) return limited;

  const account = await getAccount(request);
  const { id } = await params;
  const ok = await revokeApiKey(account, id);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "No such key." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
