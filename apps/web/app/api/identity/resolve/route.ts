import { NextResponse } from "next/server";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { resolveHandle } from "@pesarc/sdk/identity/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resolve a handle (phone, @username, 0x/Solana address, or NUBAN) to a
 * destination and the rail that reaches it. Read-only; the app asks "where does
 * this go?" and never has to know the chain.
 */
export async function GET(request: Request) {
  const limited = rateLimit(request, "identity-resolve", 60, 60_000);
  if (limited) return limited;

  const url = new URL(request.url);
  const handle = (url.searchParams.get("handle") ?? "").trim();
  const preferChain = url.searchParams.get("chain") ?? undefined;
  if (!handle || handle.length > 80) {
    return NextResponse.json({ ok: false, error: "Pass a handle to resolve." }, { status: 400 });
  }

  try {
    const destination = await resolveHandle(handle, { preferChain });
    return NextResponse.json({ ok: true, destination });
  } catch {
    return NextResponse.json({ ok: false, error: "Couldn't resolve that handle." }, { status: 500 });
  }
}
