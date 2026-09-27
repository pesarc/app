import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { verifyOtp } from "@pesarc/sdk/otp/termii";
import { mintSessionCookie, subForPhone, SESSION_COOKIE } from "@pesarc/sdk/auth/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  pinId: z.string().trim().min(1).max(120),
  code: z.string().trim().min(4).max(8),
});

/**
 * Path A phone login — step 2: verify the OTP. On success, set a long-lived,
 * signed httpOnly session cookie; the client then trades it for short Privy
 * access tokens at /api/auth/session.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "otp-verify", 10, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter the code we sent." }, { status: 400 });
  }

  const result = await verifyOtp(parsed.data.pinId, parsed.data.code);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, expired: result.expired ?? false },
      { status: 400 },
    );
  }

  const session = await mintSessionCookie(subForPhone(result.msisdn));
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
