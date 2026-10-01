// Operator webhook: put the vault's idle deposits to work across its markets
// (strategy adapters). Event-driven — call it when a deposit lands (the worker,
// an Alchemy address webhook, or the deposit mirror's auto-trigger). Dry run by
// default; execute:true (behind OPERATOR_API_SECRET) sends the operator
// allocate() txs. Mainnet needs allowMainnet. The heavy lifting is shared with
// the deposit auto-trigger in lib/vaultAllocate.

import { NextResponse } from "next/server";
import { z } from "zod";
import { planAndAllocate } from "@/lib/vaultAllocate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  chainKey: z.string().min(1).max(40),
  execute: z.boolean().optional(),
  allowMainnet: z.boolean().optional(),
});

export async function POST(request: Request) {
  const secret = process.env.OPERATOR_API_SECRET;
  if (!secret || request.headers.get("x-operator-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "chainKey required." }, { status: 400 });

  const result = await planAndAllocate(parsed.data.chainKey, {
    execute: parsed.data.execute,
    allowMainnet: parsed.data.allowMainnet,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
