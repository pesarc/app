import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { resolveAccount } from "@pesarc/sdk/banks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  accountNumber: z.string().trim().regex(/^\d{10}$/),
  bankCode: z.string().trim().min(2).max(12),
});

/** Resolve a bank account to its holder name (Paystack /bank/resolve). In demo
 *  (no provider) returns { resolved:false } so the UI proceeds without a name. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "banks-resolve", 30, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter a 10-digit account number and bank." }, { status: 400 });
  }

  const res = await resolveAccount(parsed.data.accountNumber, parsed.data.bankCode);
  if (res.error) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 422 });
  }
  return NextResponse.json({ ok: true, resolved: res.resolved, accountName: res.accountName });
}
