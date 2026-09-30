import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { getAccount } from "@pesarc/sdk/api/auth";
import { runAgentTurn } from "@pesarc/sdk/agent/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  message: z.string().trim().min(1).max(500),
  // The signed-in user's wallet, so the agent already knows "my" balance/activity
  // and never asks for an address it should already have.
  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
});

/**
 * The Pesarc agent (Celo "Agents at Work" submission), as a JSON API for the
 * in-app chat. One turn: understand a plain-language request and act — create a
 * market, pay a bill, or submit + settle a cross-border intent peer-to-peer in
 * local currency. The turn logic lives in sdk/agent/run so the WhatsApp bridge
 * shares the exact same brain.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "agent", 20, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reply: "Invalid request." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reply: "Say what you'd like to send." }, { status: 400 });
  }

  const account = await getAccount(request);
  // The in-app chat asks for consent: preview drafts a money-moving action
  // instead of executing it. The confirmed draft is run via /api/agent/execute.
  const { status, ...result } = await runAgentTurn(parsed.data.message, account, {
    preview: true,
    wallet: parsed.data.wallet,
  });
  return NextResponse.json(result, { status: status ?? 200 });
}
