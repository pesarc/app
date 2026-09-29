import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccount } from "@pesarc/sdk/api/auth";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { addAllowedIp, listAllowedIps } from "@pesarc/sdk/apiAllowlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const addSchema = z.object({
  cidr: z.string().trim().min(1).max(64),
  label: z.string().trim().max(60).optional(),
});

/** The account's API IP allowlist. Empty = all IPs allowed. */
export async function GET(request: Request) {
  const limited = rateLimit(request, "allowlist-read", 60, 60_000);
  if (limited) return limited;
  const account = await getAccount(request);
  const ips = await listAllowedIps(account);
  return NextResponse.json({ ok: true, ips });
}

/** Add an allowed IP or IPv4 CIDR. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "allowlist-write", 30, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data." },
      { status: 400 },
    );
  }
  const account = await getAccount(request);
  const row = await addAllowedIp(account, parsed.data.cidr, parsed.data.label);
  if (!row) {
    return NextResponse.json(
      { ok: false, error: "Not a valid IP address or IPv4 CIDR (e.g. 203.0.113.7 or 203.0.113.0/24)." },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, ip: row });
}
