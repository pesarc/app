import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { getAccount } from "@pesarc/sdk/api/auth";
import { runAgentExecute, type AgentDraft } from "@pesarc/sdk/agent/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The draft the agent produced in preview, handed back for the user to confirm.
const draftSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("transfer"),
    fromCode: z.string().min(1).max(12),
    toCode: z.string().min(1).max(12),
    amount: z.number().positive().max(1e12),
    recipient: z.string().max(80).optional(),
    rate: z.number().nonnegative(),
    receiveAmount: z.number().nonnegative(),
    fromFlag: z.string().max(8),
    toFlag: z.string().max(8),
    chainLabel: z.string().max(60),
    chainKey: z.string().max(40),
  }),
  z.object({
    type: z.literal("bill"),
    category: z.string().min(1).max(20),
    operatorId: z.string().min(1).max(60),
    customer: z.string().min(1).max(60),
    amount: z.number().positive().max(1e9).optional(),
    planId: z.string().max(60).optional(),
    meterType: z.string().max(20).optional(),
    operatorName: z.string().max(60),
    label: z.string().max(80),
  }),
  z.object({
    type: z.literal("payout"),
    amountNgn: z.number().positive().max(1e9),
    method: z.enum(["bank", "mobile_money"]),
    beneficiary: z.string().max(120),
    label: z.string().max(80),
  }),
  z.object({
    type: z.literal("earn"),
    action: z.enum(["deposit", "withdraw"]),
    poolId: z.string().min(1).max(40),
    poolName: z.string().max(60),
    amount: z.number().positive().max(1e12).optional(),
    apy: z.number().nonnegative().max(1000),
  }),
]);

const schema = z.object({ draft: draftSchema });

/** Execute a drafted, user-consented agent action and return its receipt. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "agent-exec", 20, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reply: "Invalid request." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reply: "Nothing to confirm." }, { status: 400 });
  }

  const account = await getAccount(request);
  const draft = parsed.data.draft as AgentDraft;

  // Stream live progress over SSE when the client asks for it: a `step` event as
  // each real stage begins, then a final `result` event with the receipt. Any
  // other client still gets a single JSON response.
  const wantsStream = (request.headers.get("accept") ?? "").includes("text/event-stream");
  if (!wantsStream) {
    const { status, ...result } = await runAgentExecute(draft, account);
    return NextResponse.json(result, { status: status ?? 200 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const { status: _status, ...result } = await runAgentExecute(draft, account, (p) =>
          send("step", p),
        );
        send("result", result);
      } catch {
        send("result", { ok: false, reply: "I couldn't complete that. Nothing was sent." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
