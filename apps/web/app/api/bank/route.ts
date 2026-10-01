import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccount } from "@pesarc/sdk/api/auth";
import { rateLimit } from "@pesarc/sdk/api/guard";
import {
  getBankAccount,
  linkBankAccount,
  bankProvider,
  getPayoutBank,
  setPayoutBank,
} from "@pesarc/sdk/bank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The caller's deposit account + saved payout bank, if any. */
export async function GET(request: Request) {
  const limited = rateLimit(request, "bank-read", 60, 60_000);
  if (limited) return limited;
  const id = await getAccount(request);
  const [account, payoutBank] = await Promise.all([getBankAccount(id), getPayoutBank(id)]);
  return NextResponse.json({ ok: true, account, payoutBank, provider: bankProvider() });
}

// The payout bank the agent cashes OUT to (real bank + transfer code + NUBAN).
const payoutSchema = z.object({
  bankCode: z.string().trim().min(2).max(12),
  accountNumber: z.string().trim().regex(/^\d{10}$/, "Enter a valid 10-digit account number."),
  accountName: z.string().trim().max(64).optional(),
});

/** Save/replace the caller's payout bank. */
export async function PUT(request: Request) {
  const limited = rateLimit(request, "bank-write", 10, 60_000);
  if (limited) return limited;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }
  const parsed = payoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data." },
      { status: 400 },
    );
  }
  const result = await setPayoutBank(await getAccount(request), {
    bankCode: parsed.data.bankCode,
    accountNumber: parsed.data.accountNumber,
    accountName: parsed.data.accountName ?? "Account holder",
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

// BVN is validated for shape and never stored; accountName is the display name.
const linkSchema = z.object({
  bvn: z.string().trim().regex(/^\d{11}$/, "Enter a valid 11-digit BVN."),
  accountName: z.string().trim().min(1).max(64).optional(),
  email: z.string().trim().email().max(120).optional(),
  phone: z.string().trim().max(20).optional(),
});

/** Link/create a payout bank account for the caller (idempotent). */
export async function POST(request: Request) {
  const limited = rateLimit(request, "bank-write", 10, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data." },
      { status: 400 },
    );
  }

  const result = await linkBankAccount(await getAccount(request), parsed.data);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
