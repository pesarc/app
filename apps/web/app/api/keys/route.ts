import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccount } from "@pesarc/sdk/api/auth";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { createApiKey, listApiKeys } from "@pesarc/sdk/apiKeys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({ label: z.string().trim().min(1).max(60) });

/** The caller's API keys (safe fields only). */
export async function GET(request: Request) {
  const limited = rateLimit(request, "keys-read", 60, 60_000);
  if (limited) return limited;
  const account = await getAccount(request);
  const keys = await listApiKeys(account);
  return NextResponse.json({ ok: true, keys });
}

/** Create a key. The full secret is returned ONCE here and never again. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "keys-write", 20, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data." },
      { status: 400 },
    );
  }
  const account = await getAccount(request);
  const created = await createApiKey(account, parsed.data.label);
  return NextResponse.json({ ok: true, key: created });
}
