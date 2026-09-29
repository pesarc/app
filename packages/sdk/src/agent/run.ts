// One agent turn, shared by every surface (the in-app chat API and the WhatsApp
// bridge). Understand a plain-language message, act on it (create a market, pay
// a bill, or submit + settle a cross-border intent), and return a plain result
// object — no HTTP/framework types — so any channel can render or forward it.
//
// Money-moving actions (a transfer or a bill) support a two-phase flow so a
// surface can ask for consent before anything is sent:
//   • PREVIEW  runAgentTurn(msg, account, { preview: true })  -> parses + prices
//     and returns a `draft` describing exactly what it WILL do. Nothing executes.
//   • CONFIRM  runAgentExecute(draft, account)                -> performs it and
//     returns a `receipt`.
// Called without `preview` (the default, e.g. the WhatsApp bridge) it executes
// directly, unchanged.

import { parseCreateMarket } from "./market-intent";
import { parseBillIntent } from "./bill-intent";
import { getBillsAdapter, findOperator, type BillCategory, type MeterType } from "../bills";
import { recordTransfer } from "../transfers";
import { createCatalog } from "../catalog";
import { parseSettlementRequest } from "../celo/agent";
import { llmConfigured } from "../llm/extract";
import { activeChain, type EvmChainConfig } from "../chain/registry";
import {
  evmAgentReady,
  evmAgentAddress,
  submitIntentOn,
  runEvmSolver,
  realizedRateOn,
  tokenByCode,
  explorerTxUrl,
} from "../chain/evm-settle";

/** A drafted, priced action awaiting the user's consent. Opaque to the channel;
 *  handed straight back to runAgentExecute to perform. */
export type AgentDraft =
  | {
      type: "transfer";
      fromCode: string;
      toCode: string;
      amount: number;
      recipient?: string;
      rate: number;
      receiveAmount: number;
      fromFlag: string;
      toFlag: string;
      chainLabel: string;
    }
  | {
      type: "bill";
      category: string;
      operatorId: string;
      customer: string;
      amount?: number;
      planId?: string;
      meterType?: string;
      operatorName: string;
      label: string;
    };

/** A completed action, rendered as a receipt by the surface. */
export type AgentReceipt = {
  kind: "transfer" | "bill";
  title: string;
  status: "settled" | "pending" | "done";
  lines: { label: string; value: string }[];
  reference?: string;
  proofUrl?: string;
  settlements?: Array<{ kind: string; url: string }>;
};

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
  /** Preview: what the agent will do, awaiting consent. */
  draft?: AgentDraft;
  /** Confirm: the completed action. */
  receipt?: AgentReceipt;
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
 * id, or a channel handle like `whatsapp:+234…`). With `opts.preview` it drafts
 * money-moving actions instead of executing them (returns a `draft`).
 */
export async function runAgentTurn(
  message: string,
  account: string,
  opts: { preview?: boolean } = {},
): Promise<AgentTurnResult> {
  const preview = opts.preview ?? false;

  // Create-a-market intent — no money moves, so it never needs consent.
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
    const operatorName = findOperator(bill.operatorId!)?.name ?? "provider";
    const label =
      bill.category === "airtime"
        ? `${operatorName} airtime`
        : bill.category === "data"
          ? `${operatorName} data`
          : `${operatorName} electricity`;
    const draft: AgentDraft = {
      type: "bill",
      category: bill.category,
      operatorId: bill.operatorId!,
      customer: bill.customer!,
      amount: bill.amount,
      planId: bill.planId,
      meterType: bill.meterType,
      operatorName,
      label,
    };
    if (preview) {
      const amountLine = bill.category === "data" ? "" : `₦${(bill.amount ?? 0).toLocaleString()} of `;
      return {
        ok: true,
        matched: false,
        reply: `I'll buy ${amountLine}${label} for ${bill.customer}. Confirm to pay.`,
        draft,
      };
    }
    return execBill(draft, account);
  }

  // On-chain settlement — the web2 -> web3 bridge. Runs on whichever chain is
  // active (Arc by default), signed by that chain's agent key. Without an agent
  // key or the LLM we still understand and reply (demo mode).
  const chain = activeChain();
  if (!evmAgentReady(chain) || !llmConfigured()) {
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

  const from = tokenByCode(chain, intent.fromCode);
  const to = tokenByCode(chain, intent.toCode);
  if (!from || !to) {
    const codes = Object.keys(chain.tokens).join(", ");
    return {
      ok: false,
      needsInput: true,
      reply: `I can move between ${codes} on ${chain.label}, but not ${intent.fromCode}→${intent.toCode} yet.`,
    };
  }

  // 2. Price it from our own realized flow (no external feed).
  const rate = await realizedRateOn(chain, from.address, to.address);
  const receiveAmount = rate > 0 ? intent.amount * rate : 0;

  const draft: AgentDraft = {
    type: "transfer",
    fromCode: from.code,
    toCode: to.code,
    amount: intent.amount,
    recipient: intent.recipient ?? undefined,
    rate,
    receiveAmount,
    fromFlag: from.flag,
    toFlag: to.flag,
    chainLabel: chain.label,
  };

  if (preview) {
    const recvLine = receiveAmount > 0 ? `; they receive about ${to.flag} ${fmt(receiveAmount)} ${to.code}` : "";
    return {
      ok: true,
      understood: intent.summary,
      reply: `I'll send ${from.flag} ${fmt(intent.amount)} ${from.code}${recvLine}, settled peer-to-peer on ${chain.label} in local currency. Confirm to send.`,
      draft,
    };
  }
  return execTransfer(chain, draft);
}

/** Execute a drafted, consented action and return its receipt. */
export async function runAgentExecute(
  draft: AgentDraft,
  account: string,
): Promise<AgentTurnResult> {
  if (draft.type === "bill") return execBill(draft, account);
  const chain = activeChain();
  if (!evmAgentReady(chain)) {
    return { ok: false, reply: "The agent isn't set up to settle on this network yet." };
  }
  return execTransfer(chain, draft);
}

// ---- execution helpers (shared by direct + confirmed paths) ----------------

async function execBill(
  draft: Extract<AgentDraft, { type: "bill" }>,
  account: string,
): Promise<AgentTurnResult> {
  try {
    const result = await getBillsAdapter().purchase({
      category: draft.category as BillCategory,
      operatorId: draft.operatorId,
      customer: draft.customer,
      amount: draft.category === "data" ? undefined : draft.amount,
      planId: draft.planId,
      meterType: draft.meterType as MeterType | undefined,
    });
    recordTransfer(
      {
        direction: "sent",
        counterparty: draft.label,
        counterpartyHandle: draft.customer,
        sendAmount: result.amount,
        sendCurrency: "NGN",
        receiveAmount: result.amount,
        receiveCurrency: "NGN",
        payout: draft.category,
        reference: result.reference,
      },
      account,
    ).catch(() => {});

    const naira = `₦${result.amount.toLocaleString()}`;
    const doneBody =
      draft.category === "airtime"
        ? `sent ${naira} ${draft.operatorName} airtime to ${draft.customer}`
        : draft.category === "data"
          ? `bought ${result.units ?? "a"} ${draft.operatorName} data bundle for ${draft.customer}`
          : `paid ${naira} to ${draft.operatorName} for meter ${draft.customer}${result.units ? ` (${result.units})` : ""}`;
    const tokenLine = result.token ? ` Prepaid token: ${result.token}.` : "";

    const lines: { label: string; value: string }[] = [
      { label: draft.category === "electricity" ? "Meter" : "To", value: draft.customer },
      { label: "Amount", value: naira },
    ];
    if (result.units) lines.push({ label: "You get", value: String(result.units) });
    if (result.token) lines.push({ label: "Token", value: result.token });

    return {
      ok: true,
      matched: false,
      billPaid: true,
      billsUrl: "/bills",
      reply: `Done — I ${doneBody}.${tokenLine} Reference ${result.reference}.`,
      receipt: {
        kind: "bill",
        title: draft.label,
        status: "done",
        lines,
        reference: result.reference,
      },
    };
  } catch {
    return {
      ok: false,
      reply: "I couldn't complete that bill just now — try again in a moment.",
    };
  }
}

async function execTransfer(
  chain: EvmChainConfig,
  draft: Extract<AgentDraft, { type: "transfer" }>,
): Promise<AgentTurnResult> {
  const from = tokenByCode(chain, draft.fromCode);
  const to = tokenByCode(chain, draft.toCode);
  if (!from || !to) {
    return { ok: false, reply: `I can't move ${draft.fromCode}→${draft.toCode} on ${chain.label}.` };
  }
  const rate = draft.rate > 0 ? draft.rate : await realizedRateOn(chain, from.address, to.address);
  const minOut = rate > 0 ? draft.amount * rate * (1 - TOLERANCE) : 1e-9;
  const recipient = (draft.recipient ?? evmAgentAddress(chain)) as `0x${string}`;

  try {
    const submitTx = await submitIntentOn(chain, {
      tokenIn: from.address,
      tokenOut: to.address,
      amountIn: draft.amount,
      minAmountOut: minOut,
      recipient,
      ref: `AGENT-${from.code}-${to.code}`,
    });

    const outcome = await runEvmSolver(chain);
    const didSettle = outcome.settled.length > 0;

    const reply = didSettle
      ? `Done. I matched your ${fmt(draft.amount)} ${from.code} against opposing ${to.code} flow and settled it peer-to-peer on ${chain.label} in local currency. ${to.flag} ${to.code} is on its way to the recipient.`
      : `I've placed your ${fmt(draft.amount)} ${from.code}→${to.code} intent on ${chain.label}. There's no one going the other way right now, so it's waiting to be matched — the moment someone sends ${to.code}→${from.code}, it settles automatically.`;

    const lines: { label: string; value: string }[] = [
      { label: "You send", value: `${from.flag} ${fmt(draft.amount)} ${from.code}` },
    ];
    if (draft.receiveAmount > 0) lines.push({ label: "They receive", value: `${to.flag} ${fmt(draft.receiveAmount)} ${to.code}` });
    lines.push({ label: "Network", value: chain.label });

    return {
      ok: true,
      understood: `${from.code}→${to.code}`,
      matched: didSettle,
      intent: { from: from.code, to: to.code, amount: draft.amount, recipient },
      submitTx,
      submitUrl: explorerTxUrl(chain, submitTx),
      settlements: outcome.settled.map((s) => ({ kind: s.kind, url: explorerTxUrl(chain, s.tx) })),
      reply,
      receipt: {
        kind: "transfer",
        title: didSettle ? "Money sent" : "Placed, matching",
        status: didSettle ? "settled" : "pending",
        lines,
        proofUrl: explorerTxUrl(chain, submitTx),
        settlements: outcome.settled.map((s) => ({ kind: s.kind, url: explorerTxUrl(chain, s.tx) })),
      },
    };
  } catch (e) {
    return {
      ok: false,
      status: 500,
      reply: e instanceof Error ? e.message.slice(0, 180) : "The settlement failed.",
    };
  }
}
