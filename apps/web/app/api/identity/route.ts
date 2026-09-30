import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { getAccount } from "@pesarc/sdk/api/auth";
import { getIdentity, upsertIdentity } from "@pesarc/sdk/identity/store";
import { normalizePhone } from "@pesarc/sdk/identity/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().max(24).optional(),
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/).optional(),
  addresses: z
    .array(z.object({ chain: z.string().min(1).max(30), address: z.string().min(3).max(120) }))
    .max(20)
    .optional(),
});

/** The signed-in user's own identity record. */
export async function GET(request: Request) {
  const limited = rateLimit(request, "identity-get", 60, 60_000);
  if (limited) return limited;
  const account = await getAccount(request);
  const identity = await getIdentity(account).catch(() => null);
  return NextResponse.json({ ok: true, identity });
}

/**
 * Register or update the signed-in user's identity: link a phone, a username, or
 * chain addresses to their account. Scoped to their own id — a user can only
 * edit their own identity. (Phone/username claiming should gate on an OTP before
 * production; this lays the store + shape.)
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "identity-link", 20, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Nothing valid to link." }, { status: 400 });
  }

  const account = await getAccount(request);
  const { phone, username, addresses } = parsed.data;
  try {
    const identity = await upsertIdentity(account, {
      phone: phone ? normalizePhone(phone) : undefined,
      username: username?.toLowerCase(),
      addresses,
    });
    return NextResponse.json({ ok: true, identity });
  } catch {
    return NextResponse.json({ ok: false, error: "Couldn't update your identity." }, { status: 500 });
  }
}
