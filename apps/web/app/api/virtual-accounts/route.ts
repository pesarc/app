import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { getAccount } from "@pesarc/sdk/api/auth";
import { createVirtualAccount, listVirtualAccounts } from "@pesarc/sdk/virtualAccounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Virtual NGN accounts for the caller's account, most-recent first. */
export async function GET(request: Request) {
  const limited = rateLimit(request, "virtual-accounts-read", 60, 60_000);
  if (limited) return limited;
  const accounts = await listVirtualAccounts(await getAccount(request));
  return NextResponse.json({ ok: true, accounts });
}

const schema = z.object({
  amount: z.number().positive().max(1_000_000_000),
  customerEmail: z.string().trim().email().max(120),
  customerName: z.string().trim().min(1).max(80).optional(),
  narration: z.string().trim().max(120).optional(),
});

/** Create a dedicated virtual NGN account (NGN in → cNGN) for this account. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "virtual-accounts-write", 20, 60_000);
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
      { status: 400 },
    );
  }
  try {
    const account = await createVirtualAccount(parsed.data, await getAccount(request));
    return NextResponse.json({ ok: true, account });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message || "Couldn't create a virtual account." },
      { status: 502 },
    );
  }
}
