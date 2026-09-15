import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { agentSessionPay, agentPayConfigured } from "@pesarc/sdk/agent-pay";

// Agent gasless: execute a settlement spend through AgentSessionKeys.pay, metered
// on-chain against the user's session cap. The agent key signs server-side — the
// user never signs or pays per action. The cap is enforced by the contract, so
// this route can't move more than the user granted.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.number().positive(),
  decimals: z.number().int().min(0).max(36).optional(),
});

export async function POST(request: Request) {
  const limited = rateLimit(request, "agent-pay", 20, 60_000);
  if (limited) return limited;

  if (!agentPayConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Agent spend not configured (needs AGENT_PK + deployed AgentSessionKeys)." },
      { status: 501 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "bad params" }, { status: 400 });
  }

  try {
    const res = await agentSessionPay(
      parsed.data.to as `0x${string}`,
      parsed.data.amount,
      parsed.data.decimals,
    );
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    // Cap exceeded / expired / no session all revert on-chain — surface cleanly.
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "agent pay failed" },
      { status: 400 },
    );
  }
}
