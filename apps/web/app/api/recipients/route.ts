import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { getAccount } from "@pesarc/sdk/api/auth";
import { listRecipients, saveRecipient } from "@pesarc/sdk/recipients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Saved recipients for the caller's account, most-recent first. */
export async function GET(request: Request) {
  const limited = rateLimit(request, "recipients-read", 60, 60_000);
  if (limited) return limited;
  const recipients = await listRecipients(await getAccount(request));
  return NextResponse.json({ ok: true, recipients });
}

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  handle: z.string().trim().min(1).max(60),
  kind: z.enum(["phone", "bank", "alias", "contact"]),
  receiveCurrency: z.string().trim().min(2).max(8),
  flag: z.string().trim().max(8).optional(),
  country: z.string().trim().max(40).optional(),
  bankCode: z.string().trim().max(12).optional(),
  accountLast4: z.string().trim().max(4).optional(),
});

/** Save (upsert) a recipient after a send. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "recipients-write", 30, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid recipient." }, { status: 400 });
  }
  const res = await saveRecipient(parsed.data, await getAccount(request));
  return NextResponse.json(res, { status: res.ok ? 200 : 200 });
}
