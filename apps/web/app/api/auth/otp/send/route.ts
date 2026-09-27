import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { sendOtp, isTermiiConfigured } from "@pesarc/sdk/otp/termii";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ phone: z.string().trim().min(7).max(20) });

/** Path A phone login — step 1: send an OTP to the phone via Termii. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "otp-send", 5, 60_000);
  if (limited) return limited;

  if (!isTermiiConfigured) {
    return NextResponse.json({ ok: false, error: "Phone login isn't available yet." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter a valid phone number." }, { status: 400 });
  }

  const result = await sendOtp(parsed.data.phone);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  // pinId is an opaque handle Termii ties to the code; not a secret.
  return NextResponse.json({ ok: true, pinId: result.pinId });
}
