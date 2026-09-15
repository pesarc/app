import { NextResponse } from "next/server";
import { z } from "zod";
import { listTransfers, recordTransfer } from "@/lib/transfers";
import { getAccount } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  direction: z.enum(["sent", "received"]),
  counterparty: z.string().trim().min(1).max(120),
  counterpartyHandle: z.string().trim().max(120).optional(),
  sendAmount: z.number().nonnegative(),
  sendCurrency: z.string().trim().min(2).max(8),
  receiveAmount: z.number().nonnegative(),
  receiveCurrency: z.string().trim().min(2).max(8),
  payout: z.string().trim().min(1).max(40),
  reference: z.string().trim().min(1).max(40),
  flag: z.string().trim().max(8).optional(),
  txHash: z.string().trim().max(80).optional(),
});

/** The caller's own transfers only — never a shared bucket for real users. */
export async function GET(request: Request) {
  const limited = rateLimit(request, "transfers-read", 60, 60_000);
  if (limited) return limited;
  const transfers = await listTransfers(await getAccount(request));
  return NextResponse.json({ ok: true, transfers });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "transfers-write", 30, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data." },
      { status: 400 }
    );
  }

  const result = await recordTransfer(parsed.data, await getAccount(request));
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: "Could not record transfer." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
