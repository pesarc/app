// One agent turn, shared by every surface (the in-app chat API and the WhatsApp
// bridge). Understand a plain-language message, act on it (create a market, pay
// a bill, or submit + settle a cross-border intent), and return a plain result
// object — no HTTP/framework types — so any channel can render or forward it.

import { parseCreateMarket } from "./market-intent";
import { parseBillIntent } from "./bill-intent";
import { getBillsAdapter, findOperator } from "../bills";
import { recordTransfer } from "../transfers";
import { createCatalog } from "../catalog";
import { parseSettlementRequest } from "../celo/agent";
import { llmConfigured } from "../llm/extract";
import { agentAddress, runCeloSolver, submitIntent } from "../celo/solver";
import {
  celoAgentReady,
  celoCurrencyByCode,
  celoExplorerTx,
  celoPublicClient,
  CELO,
} from "../celo/config";
import { realizedRateOracleAbi } from "@pesarc/abi";
import { formatUnits } from "viem";

export type AgentTurnResult = {
  ok: boolean;
  reply: string;
  /** HTTP status hint for the JSON API (channels that don't care ignore it). */
  status?: number;
  matched?: boolean;
  needsInput?: boolean;
  createdMarket?: boolean;
  billPaid?: boolean;
  marketsUrl?: string;
  billsUrl?: string;
  understood?: string;
  intent?: { from: string; to: string; amount: number; recipient: string };
  submitTx?: string;
  submitUrl?: string;
  settlements?: Array<{ kind: string; url: string }>;
};

// Slippage the agent accepts vs the realized rate when it has one.
const TOLERANCE = 0.03;

function fmt(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function billVerb(category: string): string {
  return category === "airtime"
    ? "top up airtime"
    : category === "data"
      ? "buy a data bundle"
      : "pay that electricity bill";
}

// Rule-based understanding for demo mode (no LLM / agent key). The agent still
// reads the request and replies; it just doesn't submit on-chain.
function ruleReply(message: string): AgentTurnResult {
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
    } peer-to-peer in local currency. (Demo mode — set LLM_API_KEY and the agent key to execute this on-chain.)`,
  };
}

/**
 * Run a single agent turn for `message`, scoped to `account` (a verified user
 * id, or a channel handle like `whatsapp:+234…`).
 */
export async function runAgentTurn(
  message: string,
  account: string,
): Promise<AgentTurnResult> {
  // Create-a-market intent — works without the LLM.
  const spec = parseCreateMarket(message);
  if (spec) {
    try {
      const data: Record<string, unknown> = {
        question: spec.question,
        kind: spec.kind,
        collateral: spec.collateral,
        flag: spec.kind === "sports" ? "⚽" : spec.kind === "politics" ? "🏛️" : "🌍",
        closes: spec.closes ?? "TBD",
        resolves: spec.resolves ?? "TBD",
        resolver: "attested",
        type: spec.type,
        status: "proposed",
        proposer: "AI agent",
        bond: 0,
        bondCoin: spec.collateral,
      };
      if (spec.type === "multi" && spec.outcomes) {
        data.outcomes = spec.outcomes.map((label) => ({ label, pool: 0 }));
      } else {
        data.poolYes = 0;
        data.poolNo = 0;
      }
      await createCatalog("markets", data);
      const outcomesLine =
        spec.type === "multi" && spec.outcomes
          ? ` with ${spec.outcomes.length} outcomes (${spec.outcomes.join(", ")})`
          : " (Yes / No)";
      return {
        ok: true,
        matched: false,
        createdMarket: true,
        marketsUrl: "/markets",
        reply: `Done — I created your ${spec.type === "multi" ? "multi-outcome" : "binary"} market${outcomesLine}: “${spec.question}”. It's live on the board with a Community badge, settled in ${spec.collateral}. Open Markets to seed it and take a position.`,
      };
    } catch {
      return {
        ok: false,
        reply: "I understood the market but couldn't save it — try again in a moment.",
      };
    }
  }

  // Pay-a-bill intent — works without the LLM.
  const bill = parseBillIntent(message);
  if (bill) {
    if (bill.missing.length) {
      const ask = bill.missing.includes("operator")
        ? "which provider (MTN, Airtel, Ikeja Electric…)"
        : bill.missing.includes("customer")
          ? bill.category === "electricity"
            ? "the meter number"
            : "the phone number"
          : bill.category === "data"
            ? "which bundle (e.g. 1GB)"
            : "how much";
      return {
        ok: true,
        matched: false,
        needsInput: true,
        reply: `Sure, I can ${billVerb(bill.category)} — just tell me ${ask}.`,
      };
    }
    try {
      const opName = findOperator(bill.operatorId!)?.name ?? "provider";
      const result = await getBillsAdapter().purchase({
        category: bill.category,
        operatorId: bill.operatorId!,
        customer: bill.customer!,
        amount: bill.category === "data" ? undefined : bill.amount,
        planId: bill.planId,
        meterType: bill.meterType,
      });
      const label =
        bill.category === "airtime"
          ? `${opName} airtime`
          : bill.category === "data"
            ? `${opName} data`
            : `${opName} electricity`;
      recordTransfer(
        {
          direction: "sent",
          counterparty: label,
          counterpartyHandle: bill.customer,
          sendAmount: result.amount,
          sendCurrency: "NGN",
          receiveAmount: result.amount,
          receiveCurrency: "NGN",
          payout: bill.category,
          reference: result.reference,
        },
        account,
      ).catch(() => {});

      const naira = `₦${result.amount.toLocaleString()}`;
      const doneBody =
        bill.category === "airtime"
          ? `sent ${naira} ${opName} airtime to ${bill.customer}`
          : bill.category === "data"
            ? `bought ${result.units ?? "a"} ${opName} data bundle for ${bill.customer}`
            : `paid ${naira} to ${opName} for meter ${bill.customer}${
                result.units ? ` (${result.units})` : ""
              }`;
      const tokenLine = result.token ? ` Prepaid token: ${result.token}.` : "";
      return {
        ok: true,
        matched: false,
        billPaid: true,
        billsUrl: "/bills",
        reply: `Done — I ${doneBody}.${tokenLine} Reference ${result.reference}.`,
      };
    } catch {
      return {
        ok: false,
        reply: "I couldn't complete that bill just now — try again in a moment.",
      };
    }
  }

  // Without the LLM/agent key we still understand and reply (demo mode).
  if (!celoAgentReady() || !process.env.CELO_AGENT_PK || !llmConfigured()) {
    return ruleReply(message);
  }

  // 1. Understand the request.
  let understanding;
  try {
    understanding = await parseSettlementRequest(message);
  } catch (e) {
    return {
      ok: false,
      status: 500,
      reply: e instanceof Error ? e.message.slice(0, 160) : "The agent had trouble.",
    };
  }
  if (!understanding.ok) {
    return { ok: false, needsInput: true, reply: understanding.message };
  }
  const intent = understanding.intent;

  const from = celoCurrencyByCode(intent.fromCode);
  const to = celoCurrencyByCode(intent.toCode);
  if (!from || !to) {
    return {
      ok: false,
      needsInput: true,
      reply: `I can move between ${["NGN", "GHS", "KES"].join(", ")} on Celo, but not ${intent.fromCode}→${intent.toCode} yet.`,
    };
  }

  // 2. Price it from our own realized flow (no external feed).
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
    // 3. Create the intent on-chain.
    const submitTx = await submitIntent({
      tokenIn: from.address,
      tokenOut: to.address,
      amountIn: intent.amount,
      minAmountOut: minOut,
      recipient,
      ref: `AGENT-${from.code}-${to.code}`,
    });

    // 4. Try to settle it against opposing flow, now.
    const outcome = await runCeloSolver();
    const didSettle = outcome.settled.length > 0;

    const reply = didSettle
      ? `Done. I matched your ${fmt(intent.amount)} ${from.code} against opposing ${to.code} flow and settled it peer-to-peer on Celo in local currency. ${to.flag} ${to.code} is on its way to the recipient.`
      : `I've placed your ${fmt(intent.amount)} ${from.code}→${to.code} intent on Celo. There's no one going the other way right now, so it's waiting to be matched — the moment someone sends ${to.code}→${from.code}, it settles automatically.`;

    return {
      ok: true,
      understood: intent.summary,
      matched: didSettle,
      intent: { from: from.code, to: to.code, amount: intent.amount, recipient },
      submitTx,
      submitUrl: celoExplorerTx(submitTx),
      settlements: outcome.settled.map((s: any) => ({ kind: s.kind, url: celoExplorerTx(s.tx) })),
      reply,
    };
  } catch (e) {
    return {
      ok: false,
      status: 500,
      reply: e instanceof Error ? e.message.slice(0, 180) : "The settlement failed.",
    };
  }
}
