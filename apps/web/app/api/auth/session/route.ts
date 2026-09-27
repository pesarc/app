import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { subFromSession, mintSessionToken, SESSION_COOKIE } from "@pesarc/sdk/auth/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns a fresh short-lived access token for Privy custom auth, derived from
 * the signed session cookie. The client's getCustomAccessToken() calls this.
 */
export async function GET() {
  const jar = await cookies();
  const sub = await subFromSession(jar.get(SESSION_COOKIE)?.value);
  if (!sub) {
    return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });
  }
  const token = await mintSessionToken(sub);
  return NextResponse.json({ ok: true, authenticated: true, token });
}

/** Log out — clear the session cookie. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
