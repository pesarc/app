import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { parseSettlementRequest } from "@pesarc/sdk/celo/agent";
import { llmConfigured } from "@pesarc/sdk/llm/extract";
import {
  agentAddress,
  runCeloSolver,
  submitIntent,
} from "@pesarc/sdk/celo/solver";
import {
  celoAgentReady,
  celoCurrencyByCode,
  celoExplorerTx,
  celoPublicClient,
  CELO,
} from "@pesarc/sdk/celo/config";
import { realizedRateOracleAbi } from "@pesarc/abi";
import { formatUnits } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({ message: z.string().trim().min(1).max(500) });

// Rule-based understanding for demo mode (no LLM / agent key configured). The
// agent still reads the request and replies; it just doesn't submit on-chain.
function ruleReply(message: string) {
  const amt = (message.replace(/,/g, "").match(/\d+(\.\d+)?/) || [])[0];
  const cur = /naira|ngn/i.test(message)
    ? "naira"
    : /cedi|ghs/i.test(message)
    ? "cedis"
    : /shilling|kes/i.test(message)
    ? "shillings"
    : "";
  const dest = /ghana/i.test(message)
    ? "Ghana"
    : /kenya/i.test(message)
    ? "Kenya"
    : /nigeria/i.test(message)
    ? "Nigeria"
    : "";
  if (!amt) {
    return {
      ok: true,
      matched: false,
      reply:
        "Tell me an amount and where to send — e.g. “send 50,000 naira to Ghana” — and I'll settle it peer-to-peer in local currency.",
    };
  }
  return {
    ok: true,
    matched: false,
    reply: `Got it — I'd settle ${Number(amt).toLocaleString()} ${cur}${
      dest ? ` to ${dest}` : ""
    } peer-to-peer in local currency, no dollar in the path. (Demo mode — set LLM_API_KEY and the agent key to execute this on-chain.)`,
  };
}

// Slippage the agent accepts vs the realized rate when it has one.
const TOLERANCE = 0.03;

/**
 * The Pesarc settlement agent (Celo "Agents at Work" submission).
 *
 * One turn: understand a plain-language request, turn it into an on-chain
 * cross-border intent, and let the autonomous solver settle it peer-to-peer in
 * local currency — no US dollar in the path. Reports back what it did, with
 * proof.
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

  // Usable without keys: when the agent can't act on-chain (no LLM or agent
  // key), still understand the request and reply (demo mode) instead of 501.
  if (!celoAgentReady() || !process.env.CELO_AGENT_PK || !llmConfigured()) {
    return NextResponse.json(ruleReply(parsed.data.message));
  }

  // 1. Understand the request.
  let understanding;
  try {
    understanding = await parseSettlementRequest(parsed.data.message);
  } catch (e) {
    return NextResponse.json(
      { ok: false, reply: e instanceof Error ? e.message.slice(0, 160) : "The agent had trouble." },
      { status: 500 },
    );
  }
  if (!understanding.ok) {
    return NextResponse.json({ ok: false, needsInput: true, reply: understanding.message });
  }
  const intent = understanding.intent;

  const from = celoCurrencyByCode(intent.fromCode);
  const to = celoCurrencyByCode(intent.toCode);
  if (!from || !to) {
    return NextResponse.json({
      ok: false,
      needsInput: true,
      reply: `I can move between ${["NGN", "GHS", "KES"].join(", ")} on Celo, but not ${intent.fromCode}→${intent.toCode} yet.`,
    });
  }

  // 2. Price it from our own realized flow (no external feed). Fall back to a
  //    tiny floor if this corridor hasn't settled yet.
  let minOut = 1e-9;
  try {
    const client = celoPublicClient();
    const has = (await client.readContract({
      address: CELO.realizedOracle as `0x${string}`,
      abi: realizedRateOracleAbi,
      functionName: "hasData",
      args: [from.address, to.address],
    })) as boolean;
    if (has) {
      const rate1e18 = (await client.readContract({
        address: CELO.realizedOracle as `0x${string}`,
        abi: realizedRateOracleAbi,
        functionName: "latestRate1e18",
        args: [from.address, to.address],
      })) as bigint;
      const rate = Number(formatUnits(rate1e18, 18));
      if (rate > 0) minOut = intent.amount * rate * (1 - TOLERANCE);
    }
  } catch {
    /* keep floor */
  }

  const recipient = (intent.recipient ?? agentAddress()) as `0x${string}`;

  try {
    // 3. Create the intent on-chain (the agent acts).
    const submitTx = await submitIntent({
      tokenIn: from.address,
      tokenOut: to.address,
      amountIn: intent.amount,
      minAmountOut: minOut,
      recipient,
      ref: `AGENT-${from.code}-${to.code}`,
    });

    // 4. Try to settle it against opposing flow, right now.
    const outcome = await runCeloSolver();
    const didSettle = outcome.settled.length > 0;

    const reply = didSettle
      ? `Done. I matched your ${fmt(intent.amount)} ${from.code} against opposing ${to.code} flow and settled it peer-to-peer on Celo — no dollar in the path. ${to.flag} ${to.code} is on its way to the recipient.`
      : `I've placed your ${fmt(intent.amount)} ${from.code}→${to.code} intent on Celo. There's no one going the other way right now, so it's waiting to be matched — the moment someone sends ${to.code}→${from.code}, it settles automatically, no dollar involved.`;

    return NextResponse.json({
      ok: true,
      understood: intent.summary,
      matched: didSettle,
      intent: {
        from: from.code,
        to: to.code,
        amount: intent.amount,
        recipient,
      },
      submitTx,
      submitUrl: celoExplorerTx(submitTx),
      settlements: outcome.settled.map((s) => ({ ...s, url: celoExplorerTx(s.tx) })),
      reply,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, reply: e instanceof Error ? e.message.slice(0, 180) : "The settlement failed." },
      { status: 500 },
    );
  }
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
