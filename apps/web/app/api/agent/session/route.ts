// Session-key grant lifecycle for the agent: create a pending key, finalize it
// with the on-chain grant context, read its status, revoke it. Testnet + flag
// gated (permissions.ts); mainnet is blocked there. The server never returns the
// sealed key — only the public session address and safe status.
//
// Keyed by the on-chain smart-account address: a grant only ever WORKS if that
// account's real owner signed the grant context in-app, so a pending key minted
// for an address nobody controls is inert.

import { NextResponse } from "next/server";
import { z } from "zod";
import { parseUnits } from "viem";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { getAccount } from "@pesarc/sdk/api/auth";
import { sessionKeysAllowed, defaultExpirySec, MAX_EXPIRY_SEC } from "@pesarc/sdk/wallet/session-keys/permissions";
import { createPending, finalizeGrant, getGrant, revokeGrant, toSafe } from "@pesarc/sdk/wallet/session-keys/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const MAX_CAP_USDC = 1000; // testnet guardrail

const createSchema = z.object({
  account: addr,
  chainKey: z.string().min(1).max(40),
  capUsdc: z.number().positive().max(MAX_CAP_USDC),
  ttlSec: z.number().int().positive().max(MAX_EXPIRY_SEC).optional(),
});

const finalizeSchema = z.object({
  account: addr,
  chainKey: z.string().min(1).max(40),
  sessionAddress: addr,
  context: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

/** Status of the caller's grant for a chain (no secrets). */
export async function GET(request: Request) {
  const limited = rateLimit(request, "session-get", 60, 60_000);
  if (limited) return limited;
  const url = new URL(request.url);
  const account = url.searchParams.get("account") ?? "";
  const chainKey = url.searchParams.get("chainKey") ?? "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(account) || !chainKey) {
    return NextResponse.json({ ok: false, error: "account and chainKey required." }, { status: 400 });
  }
  const g = await getGrant(account, chainKey).catch(() => null);
  return NextResponse.json({ ok: true, enabled: sessionKeysAllowed(chainKey), grant: g ? toSafe(g) : null });
}

/** Create a pending session key: returns the public address to grant on-chain. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "session-create", 10, 60_000);
  if (limited) return limited;
  await getAccount(request); // require a signed-in caller

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const { account, chainKey, capUsdc, ttlSec } = parsed.data;
  if (!sessionKeysAllowed(chainKey)) {
    return NextResponse.json({ ok: false, error: "Session keys are not enabled on this chain." }, { status: 403 });
  }
  const expirySec = defaultExpirySec(ttlSec ?? MAX_EXPIRY_SEC);
  const capWei = parseUnits(String(capUsdc), 6);
  try {
    const { sessionAddress } = await createPending({ account, chainKey, capWei, expirySec });
    return NextResponse.json({ ok: true, sessionAddress, expirySec, capWei: capWei.toString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Could not create a session key." }, { status: 500 });
  }
}

/** Finalize: attach the on-chain grant context and activate. */
export async function PUT(request: Request) {
  const limited = rateLimit(request, "session-finalize", 10, 60_000);
  if (limited) return limited;
  await getAccount(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }
  const parsed = finalizeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const { account, chainKey, sessionAddress, context } = parsed.data;
  if (!sessionKeysAllowed(chainKey)) {
    return NextResponse.json({ ok: false, error: "Session keys are not enabled on this chain." }, { status: 403 });
  }
  try {
    const grant = await finalizeGrant({ account, chainKey, sessionAddress, context: context as `0x${string}` });
    return NextResponse.json({ ok: true, grant });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Could not finalize." }, { status: 500 });
  }
}

/** Revoke the caller's grant for a chain. */
export async function DELETE(request: Request) {
  const limited = rateLimit(request, "session-revoke", 20, 60_000);
  if (limited) return limited;
  await getAccount(request);
  const url = new URL(request.url);
  const account = url.searchParams.get("account") ?? "";
  const chainKey = url.searchParams.get("chainKey") ?? "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(account) || !chainKey) {
    return NextResponse.json({ ok: false, error: "account and chainKey required." }, { status: 400 });
  }
  await revokeGrant(account, chainKey).catch(() => {});
  return NextResponse.json({ ok: true });
}
