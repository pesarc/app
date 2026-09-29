import { NextResponse } from "next/server";
import { getAccount } from "@pesarc/sdk/api/auth";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { removeAllowedIp } from "@pesarc/sdk/apiAllowlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Remove one allowed IP the caller owns. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, "allowlist-remove", 30, 60_000);
  if (limited) return limited;

  const account = await getAccount(request);
  const { id } = await params;
  const ok = await removeAllowedIp(account, id);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "No such entry." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
