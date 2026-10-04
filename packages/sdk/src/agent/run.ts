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
import { parseBalanceIntent, parseActivityIntent } from "./balance-intent";
import { parseCashoutIntent } from "./cashout-intent";
import { parseSwapIntent, crossesEnvironments } from "./swap-intent";
import { parseRouteIntent, routePlanReply, type RoutePlan } from "./route-intent";
export type { RoutePlan } from "./route-intent";
import { parseEarnIntent } from "./earn-intent";
import { parseStakeIntent } from "./stake-intent";
import { fetchLiveMarkets } from "../markets.live";

/** A drafted on-chain market stake the user confirms IN CHAT (no redirect). The
 *  numeric marketId + collateral come from the LIVE on-chain market, so the stake
 *  can't land in the wrong pool. The StakeCard signs it via the smart wallet. */
export type StakePlan = {
  marketId: number;
  question: string;
  side: "yes" | "no";
  amount?: number;
  /** Collateral token address from the live market. */
  collateralToken: `0x${string}`;
  chainKey?: string;
};
import { emitStep, type OnProgress } from "./progress";
import { POOLS, poolApy, findPool, type Pool } from "../earn";
import { deposit as earnDeposit, withdraw as earnWithdraw, listPositions } from "../earn-positions";
import { toMarket } from "../catalog-map";
import { fetchAggregatedBalance } from "../chain/aggregateBalance";
import { fetchOnchainActivity } from "../chain/history";
import { getBankAccount, getPayoutBank } from "../bank";
import { createPayout } from "../payouts";
import { sendReference } from "../reference";
import { getBillsAdapter, findOperator, type BillCategory, type MeterType } from "../bills";
import { recordTransfer } from "../transfers";
import { createCatalog, listCatalog } from "../catalog";
import { parseSettlementRequest } from "../celo/agent";
import { llmConfigured } from "../llm/extract";
import { activeChain, chainByKey, type EvmChainConfig } from "../chain/registry";
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
      /** The chain this settles on, so execute runs on the same chain as preview. */
      chainKey: string;
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
    }
  | {
      type: "payout";
      amountNgn: number;
      method: "bank" | "mobile_money";
      beneficiary: string;
      label: string;
    }
  | {
      type: "earn";
      action: "deposit" | "withdraw";
      poolId: string;
      poolName: string;
      amount?: number;
      apy: number;
    };

/** A completed action, rendered as a receipt by the surface. */
export type AgentReceipt = {
  kind: "transfer" | "bill" | "payout" | "earn";
  title: string;
  status: "settled" | "pending" | "done";
  lines: { label: string; value: string }[];
  reference?: string;
  proofUrl?: string;
  /** On-chain transaction hash for the action, when it has one. */
  txHash?: string;
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
  /** Deep link to the Cross-chain screen, prefilled for a recognized move. */
  crossChainUrl?: string;
  understood?: string;
  intent?: { from: string; to: string; amount: number; recipient: string };
  submitTx?: string;
  submitUrl?: string;
  settlements?: Array<{ kind: string; url: string }>;
  /** Preview: what the agent will do, awaiting consent. */
  draft?: AgentDraft;
  /** Confirm: the completed action. */
  receipt?: AgentReceipt;
  /** A multi-hop cross-chain route the browser runs leg by leg. */
  route?: RoutePlan;
  /** An on-chain market stake the user confirms + signs in chat (no redirect). */
  stake?: StakePlan;
};

// Slippage the agent accepts vs the realized rate when it has one.
const TOLERANCE = 0.03;

function fmt(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** A chain's label without the network suffix, for compact table cells. */
function plainChain(label: string): string {
  return label.replace(/\s*(mainnet|testnet|sepolia|devnet)\s*/gi, "").trim() || label;
}

/** Pick an Earn pool for a deposit request: by named currency corridor, then by
 *  explicit pool mention, else the low-risk stable reserve. */
function resolvePool(query: string): Pool {
  const q = query.toLowerCase();
  const byCurrency: [RegExp, string][] = [
    [/\b(ngn|naira)\b/, "usd-ngn-hub"],
    [/\b(kes|shilling)\b/, "usd-kes"],
    [/\b(ghs|cedi)\b/, "eur-ghs"],
    [/\b(gbp|pound|sterling)\b/, "gbp-ngn"],
  ];
  for (const [re, id] of byCurrency) if (re.test(q)) return findPool(id) ?? POOLS[0];
  const named = POOLS.find((p) => q.includes(p.id) || q.includes(p.corridor.toLowerCase()));
  return named ?? findPool("usdc-stable") ?? POOLS[0];
}

/** Among a user's held positions, the one the query names, if any. */
function resolveHeldPool<T extends { poolId: string }>(query: string, positions: T[]): T | undefined {
  const q = query.toLowerCase();
  return positions.find((pos) => {
    const p = findPool(pos.poolId);
    return p && (q.includes(p.id) || q.includes(p.corridor.toLowerCase()));
  });
}

/** Best market match for a free-text query, by shared meaningful words. */
function matchMarket<T extends { question: string }>(markets: T[], query: string): T | null {
  const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
  const q = words(query);
  if (!q.size) return markets[0] ?? null;
  let best: T | null = null;
  let bestScore = 0;
  for (const m of markets) {
    const mw = words(m.question);
    let score = 0;
    for (const w of q) if (mw.has(w)) score++;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return bestScore > 0 ? best : null;
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
  // A recognizable local-currency send: reflect exactly what I understood.
  if (amt && (cur || dest)) {
    return {
      ok: true,
      matched: false,
      reply: `Got it. I'd settle **${Number(amt).toLocaleString()} ${cur || "in local currency"}**${
        dest ? ` to **${dest}**` : ""
      }, peer-to-peer in local currency. (Demo mode: set the agent key to execute this on-chain.)`,
    };
  }
  // Anything I couldn't place: show what I can actually do, formatted, so the
  // reply is never a dead end.
  return {
    ok: true,
    matched: false,
    reply: [
      "I'm not sure what to do with that yet. Here's what I can help with:",
      "",
      "- **Send money** across borders, e.g. `send 50,000 naira to Ghana`",
      "- **Move an asset across chains**, e.g. `swap 10 USDC from Arc to Base`",
      "- **Check your balance** or **recent activity**",
      "- **Pay a bill**: airtime, data or electricity",
      "- **Cash out** to your linked bank",
      "- **Create a prediction market**",
    ].join("\n"),
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
  opts: { preview?: boolean; wallet?: string; chainKey?: string } = {},
): Promise<AgentTurnResult> {
  const preview = opts.preview ?? false;
  // The signed-in user's wallet, so "my balance / activity" needs no address.
  const myWallet = opts.wallet;

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

  // Earn: put money to work in a corridor pool, take it out, or report what it's
  // earning. Earn is a tracked ledger (no wallet signature), so the agent acts on
  // it directly. Deposit/withdraw move money and draft for consent; positions is
  // read-only. Checked before cash-out so "withdraw from savings" isn't a bank
  // withdrawal.
  const earn = parseEarnIntent(message);
  if (earn) {
    if (earn.action === "positions") {
      try {
        const positions = await listPositions(account);
        if (!positions.length) {
          return {
            ok: true,
            matched: false,
            reply:
              "You don't have any savings yet. Say something like **earn on 100 USDC** and I'll put it to work in a corridor pool.",
          };
        }
        let principalSum = 0;
        let yieldSum = 0;
        const rows = positions
          .map((p) => {
            const pool = findPool(p.poolId);
            const apy = pool ? poolApy(pool) : 0;
            principalSum += p.principal;
            yieldSum += (p.principal * apy) / 100;
            return `| ${pool?.corridor ?? p.poolId} | $${fmt(p.principal)} | ${apy.toFixed(1)}% |`;
          })
          .join("\n");
        const reply = [
          `You have **$${fmt(principalSum)}** earning, about **$${fmt(yieldSum)}/yr** at current rates.`,
          "",
          "| Pool | Balance | APY |",
          "| --- | --- | --- |",
          rows,
        ].join("\n");
        return { ok: true, matched: false, reply };
      } catch {
        return { ok: false, reply: "I couldn't read your savings just now. Try again shortly." };
      }
    }

    if (earn.action === "withdraw") {
      const positions = await listPositions(account).catch(() => []);
      if (!positions.length) {
        return { ok: true, needsInput: true, reply: "You don't have anything in savings to withdraw yet." };
      }
      const target = resolveHeldPool(earn.query, positions) ?? positions[0];
      const pool = findPool(target.poolId);
      const draft: AgentDraft = {
        type: "earn",
        action: "withdraw",
        poolId: target.poolId,
        poolName: pool?.corridor ?? "savings",
        apy: pool ? poolApy(pool) : 0,
      };
      if (preview) {
        return {
          ok: true,
          reply: `I'll withdraw your **$${fmt(target.principal)}** from ${draft.poolName} back to your balance. Confirm to withdraw.`,
          draft,
        };
      }
      return execEarn(draft, account);
    }

    // Deposit.
    const pool = resolvePool(earn.query);
    const apy = poolApy(pool);
    if (!earn.amount) {
      return {
        ok: true,
        needsInput: true,
        reply: `How much would you like to put into **${pool.corridor}** (earning about ${apy.toFixed(1)}% a year)?`,
      };
    }
    const draft: AgentDraft = {
      type: "earn",
      action: "deposit",
      poolId: pool.id,
      poolName: pool.corridor,
      amount: earn.amount,
      apy,
    };
    if (preview) {
      const yr = (earn.amount * apy) / 100;
      return {
        ok: true,
        understood: `Earn ${fmt(earn.amount)} in ${pool.corridor}`,
        reply: `I'll put **$${fmt(earn.amount)}** into **${pool.corridor}**, earning about **${apy.toFixed(1)}% a year** (about $${fmt(yr)}). You can withdraw anytime. Confirm to start earning.`,
        draft,
      };
    }
    return execEarn(draft, account);
  }

  // Cash out to the user's linked bank: settle on Arc, then pay out fiat via the
  // ramp partner (Paystack in prod). Money moves, so preview drafts it for consent.
  const cashout = parseCashoutIntent(message);
  if (cashout) {
    const bank = await getBankAccount(account);
    if (!bank || bank.status !== "active") {
      return {
        ok: true,
        needsInput: true,
        reply: "Link a bank account first (in Add money, or the You tab) and I'll cash out to it.",
      };
    }
    const label = `${bank.bankName} (${bank.accountName})`;
    const draft: AgentDraft = {
      type: "payout",
      amountNgn: cashout.amountNgn,
      method: "bank",
      beneficiary: bank.accountName,
      label,
    };
    if (preview) {
      return {
        ok: true,
        understood: `Cash out NGN ${fmt(cashout.amountNgn)} to ${label}`,
        reply: `I'll cash out ₦${fmt(cashout.amountNgn)} to your ${bank.bankName} account ending ${bank.accountNumber.slice(-4)}, settled on Arc and paid out to your bank. Confirm to send.`,
        draft,
      };
    }
    return execPayout(draft, account);
  }

  // Read-only: check on-chain balances for the user's own wallet, or a given 0x
  // address. No money moves, so no consent — the agent just reports what it reads.
  const balAsk = parseBalanceIntent(message);
  if (balAsk) {
    const owner = (balAsk.address ?? myWallet ?? account) as `0x${string}`;
    if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) {
      return {
        ok: true,
        needsInput: true,
        reply: "Connect or sign in with your wallet and I'll read your balance. Or paste a 0x address to check any wallet.",
      };
    }
    try {
      const { total, holdings } = await fetchAggregatedBalance(owner, "USD");
      if (!holdings.length) {
        return {
          ok: true,
          matched: false,
          reply: balAsk.address
            ? "That wallet holds no stablecoins I can see across the chains I read."
            : "You don't hold any stablecoins yet on the chains I read. Add money to get started.",
        };
      }
      const rows = holdings
        .slice(0, 12)
        .map((h) => `| ${fmt(h.amount)} | ${h.symbol} | ${plainChain(h.chainLabel)} |`)
        .join("\n");
      const who = balAsk.address ? "That wallet holds" : "You hold";
      const reply = [
        `${who} about **$${fmt(total)}** across chains.`,
        "",
        "| Amount | Asset | Chain |",
        "| --- | --- | --- |",
        rows,
      ].join("\n");
      return { ok: true, matched: false, reply };
    } catch {
      return { ok: false, reply: "I couldn't read that balance on-chain just now. Try again shortly." };
    }
  }

  // Read-only: recent on-chain activity for the user's wallet, or a given address.
  const actAsk = parseActivityIntent(message);
  if (actAsk) {
    const owner = (actAsk.address ?? myWallet ?? account) as `0x${string}`;
    if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) {
      return {
        ok: true,
        needsInput: true,
        reply: "Connect or sign in with your wallet and I'll show your activity. Or paste a 0x address to check any wallet.",
      };
    }
    try {
      const items = await fetchOnchainActivity(owner, 6);
      if (!items.length) {
        return { ok: true, matched: false, reply: "No recent on-chain activity for that wallet yet." };
      }
      const lines = items
        .map(
          (a) =>
            `- **${a.kind === "sent" ? "Sent" : "Received"} ${fmt(a.amount)} ${a.symbol}** ${a.kind === "sent" ? "to" : "from"} \`${a.counterparty}\` · ${plainChain(a.chainLabel)}`,
        )
        .join("\n");
      const who = actAsk.address ? "That wallet's recent activity:" : "Your recent activity:";
      return { ok: true, matched: false, reply: `${who}\n\n${lines}` };
    } catch {
      return { ok: false, reply: "I couldn't read that wallet's activity just now. Try again shortly." };
    }
  }

  // Multi-hop route ("route 5 USDC across Arc to Arbitrum to Base to Arc") —
  // three or more chains, so it's a sequence of CCTP legs, not one hop. The agent
  // plans it; the browser runs it leg by leg, signing each with the smart wallet
  // and waiting for settlement between hops. Checked before the single-hop swap.
  const route = parseRouteIntent(message);
  if (route) {
    const { reply, understood } = routePlanReply(route);
    return { ok: true, matched: false, understood, reply, route };
  }

  // Cross-chain move ("swap USDC on Arc to Base") — names two chains, so it's a
  // bridge. The agent NEVER auto-sends it: it preps the path, shows the exact
  // tokens + chains, and the user gives explicit consent IN CHAT (the route card's
  // confirm) before anything signs. Execution then runs in place via the in-app
  // smart wallet — gaslessly, no wallet pop-up, no redirect to another page.
  const swap = parseSwapIntent(message);
  if (swap) {
    // Guardrail: never move funds between testnet and mainnet — they are separate
    // networks with separate balances, so this is refused rather than misrouted.
    if (crossesEnvironments(message)) {
      return {
        ok: true,
        needsInput: true,
        understood: `Blocked cross-environment move ${swap.from} to ${swap.to}`,
        reply:
          "I can't move funds between **testnet** and **mainnet** — they're separate networks with separate balances. Tell me a single network (for example \"Arc testnet to Base testnet\", or both on mainnet) and I'll lay out the route.",
      };
    }
    // USDC rides CCTP, which the browser route runner signs on ANY chain we
    // support (Arc included). Hand the UI a one-leg route it lays out for review
    // and runs IN CHAT once the user confirms — never auto-executed.
    if (swap.token === "USDC") {
      const plan = { token: "USDC" as const, amount: swap.amount, chains: [swap.from, swap.to] };
      const { reply, understood } = routePlanReply(plan);
      return { ok: true, matched: false, understood, reply, route: plan };
    }

    // Everything else can't go cross-chain here: the rail is Circle CCTP, which is
    // USDC-only. Explain it in chat (no redirect) — the user can swap to USDC first.
    const reply = [
      `Moving **${swap.token}** across chains isn't supported yet — the cross-chain rail only moves **USDC**.`,
      "",
      `To do this: swap your ${swap.token} into USDC first, then ask me to move the USDC from ${swap.from} to ${swap.to} and I'll lay out the route for you to confirm here.`,
    ].join("\n");
    return {
      ok: true,
      matched: false,
      understood: `Move ${swap.token} ${swap.from} to ${swap.to}`,
      reply,
    };
  }

  // Market stake ("stake 20 on Yes for USD/NGN"). The agent lays it out and the
  // user confirms + signs IN CHAT (no redirect). It prefers a REAL on-chain
  // market — which carries the true numeric marketId + collateral — so the stake
  // can never land in the wrong pool; the StakeCard shows the market for the user
  // to affirm before signing.
  const stake = parseStakeIntent(message);
  if (stake) {
    const liveRaw = await fetchLiveMarkets().catch(() => null);
    const tradable = (liveRaw ?? [])
      .filter((m) => m.question && m.status === 0 && m.collateral) // binary, Trading
      .map((m) => ({ ...m, question: m.question as string }));
    const liveMatch = matchMarket(tradable, stake.query);
    if (liveMatch) {
      const sideLabel = stake.side === "yes" ? "Yes" : "No";
      const reply = [
        `Ready to stake on **${sideLabel}**:`,
        "",
        `**${liveMatch.question}**`,
        "",
        "Check the market, side and amount below, then confirm here — I'll sign it in your wallet. Fees are paid in USDC. No redirect.",
      ].join("\n");
      return {
        ok: true,
        matched: false,
        understood: `Stake ${sideLabel} on ${liveMatch.question}`,
        reply,
        stake: {
          marketId: liveMatch.id,
          question: liveMatch.question,
          side: stake.side,
          amount: stake.amount,
          collateralToken: liveMatch.collateral as `0x${string}`,
          chainKey: opts.chainKey ?? activeChain().key,
        },
      };
    }

    // No live on-chain market matched — fall back to the catalog list (a market
    // that isn't on-chain yet can't be staked in chat).
    const markets = await listCatalog("markets")
      .then((items) => items.map((it, i) => toMarket(it.data, i)).filter((m): m is NonNullable<typeof m> => Boolean(m)))
      .catch(() => []);
    const match = matchMarket(markets, stake.query);
    if (!match) {
      if (markets.length) {
        const list = markets
          .slice(0, 5)
          .map((mk) => `- ${mk.question}`)
          .join("\n");
        return {
          ok: true,
          matched: false,
          reply: `I couldn't pin that to a live market. Here's what's live now:\n\n${list}\n\nOpen Markets to place your stake.`,
          marketsUrl: "/markets",
        };
      }
      return {
        ok: true,
        matched: false,
        reply:
          "No markets are live yet. Want me to create one? Try **create a market: will USD/NGN close above 1,600 in December?**",
      };
    }
    const amt = stake.amount ? `**$${fmt(stake.amount)}** on ` : "";
    const sideLabel = stake.side === "yes" ? "Yes" : "No";
    const reply = [
      `Ready to stake ${amt}**${sideLabel}**:`,
      "",
      "| | |",
      "| --- | --- |",
      `| **Market** | ${match.question} |`,
      `| **Side** | ${sideLabel} |`,
      ...(stake.amount ? [`| **Stake** | $${fmt(stake.amount)} |`] : []),
      "",
      "Placing a bet is signed by you. Tap **Open Markets** to review and sign it in-app.",
    ].join("\n");
    const q = new URLSearchParams({ stake: match.id, side: stake.side });
    return {
      ok: true,
      matched: false,
      understood: `Stake ${sideLabel} on ${match.question}`,
      reply,
      marketsUrl: `/markets?${q.toString()}`,
    };
  }

  // On-chain settlement — the web2 -> web3 bridge. Runs on the chain the user is
  // on (opts.chainKey, from their wallet), falling back to the default active
  // chain. Signed by that chain's agent key. Without a wired chain + agent key +
  // the LLM we still understand and reply (demo mode).
  const chain = (opts.chainKey && chainByKey(opts.chainKey)) || activeChain();
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
    chainKey: chain.key,
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

/** Execute a drafted, consented action and return its receipt. `onProgress` is
 *  called as each real stage begins, so a surface can stream live progress. */
export async function runAgentExecute(
  draft: AgentDraft,
  account: string,
  onProgress?: OnProgress,
): Promise<AgentTurnResult> {
  if (draft.type === "bill") return execBill(draft, account, onProgress);
  if (draft.type === "payout") return execPayout(draft, account, onProgress);
  if (draft.type === "earn") return execEarn(draft, account, onProgress);
  // Execute on the same chain the draft was priced on.
  const chain = (draft.chainKey && chainByKey(draft.chainKey)) || activeChain();
  if (!evmAgentReady(chain)) {
    return { ok: false, reply: "The agent isn't set up to settle on this network yet." };
  }
  return execTransfer(chain, draft, onProgress);
}

/** Execute a consented bank cash-out: pay out fiat to the user's linked bank via
 *  the ramp partner (Paystack in prod), and return a receipt. */
async function execPayout(
  draft: Extract<AgentDraft, { type: "payout" }>,
  account: string,
  onProgress?: OnProgress,
): Promise<AgentTurnResult> {
  // Prefer the user's saved PAYOUT bank (has a transfer code -> real Paystack
  // transfer). Fall back to the deposit account only if no payout bank is set.
  const payoutBank = await getPayoutBank(account);
  const bank = await getBankAccount(account);
  const dest = payoutBank
    ? {
        bankName: "your bank",
        accountName: payoutBank.accountName,
        accountNumber: payoutBank.accountNumber,
        bankCode: payoutBank.bankCode as string | undefined,
      }
    : bank && bank.status === "active"
      ? { bankName: bank.bankName, accountName: bank.accountName, accountNumber: bank.accountNumber, bankCode: undefined }
      : null;
  if (!dest) {
    return { ok: false, reply: "I couldn't find a bank to pay out to. Add a payout bank first, then ask me again." };
  }
  try {
    emitStep(onProgress, "payout", 0);
    const reference = sendReference();
    emitStep(onProgress, "payout", 1);
    const payout = await createPayout(
      {
        reference,
        beneficiary: dest.accountName,
        method: "bank",
        amountNgn: draft.amountNgn,
        accountName: dest.accountName,
        accountNumber: dest.accountNumber,
        bankCode: dest.bankCode,
      },
      account,
    );
    recordTransfer(
      {
        direction: "sent",
        counterparty: `${dest.bankName} (${dest.accountName})`,
        counterpartyHandle: dest.accountNumber,
        sendAmount: draft.amountNgn,
        sendCurrency: "NGN",
        receiveAmount: draft.amountNgn,
        receiveCurrency: "NGN",
        payout: "bank",
        reference,
      },
      account,
    ).catch(() => {});

    emitStep(onProgress, "payout", 2);
    const naira = `₦${fmt(draft.amountNgn)}`;
    const paid = payout.status === "paid";
    const last4 = dest.accountNumber.slice(-4);
    return {
      ok: true,
      matched: false,
      reply: `Done — I'm paying out ${naira} to ${dest.bankName} account ending ${last4}. Reference ${reference}${paid ? ", paid" : `, ${payout.status}`}.`,
      receipt: {
        kind: "payout",
        title: "Cash out to bank",
        status: paid ? "done" : "pending",
        lines: [
          { label: "To", value: `${dest.bankName} ••${last4}` },
          { label: "Amount", value: naira },
          { label: "Status", value: payout.status },
        ],
        reference,
      },
    };
  } catch (e) {
    return {
      ok: false,
      reply: e instanceof Error ? `Cash out failed: ${e.message.slice(0, 140)}` : "Cash out failed.",
    };
  }
}

/** Execute a consented Earn action against the tracked corridor-pool ledger. */
async function execEarn(
  draft: Extract<AgentDraft, { type: "earn" }>,
  account: string,
  onProgress?: OnProgress,
): Promise<AgentTurnResult> {
  try {
    emitStep(onProgress, "earn", 0);
    if (draft.action === "deposit") {
      const amount = draft.amount ?? 0;
      emitStep(onProgress, "earn", 1);
      const principal = await earnDeposit(account, draft.poolId, amount);
      emitStep(onProgress, "earn", 2);
      const yr = (amount * draft.apy) / 100;
      recordTransfer(
        {
          direction: "sent",
          counterparty: `Earn · ${draft.poolName}`,
          counterpartyHandle: draft.poolId,
          sendAmount: amount,
          sendCurrency: "USD",
          receiveAmount: amount,
          receiveCurrency: "USD",
          payout: "earn",
          reference: `EARN-${draft.poolId}`,
        },
        account,
      ).catch(() => {});
      return {
        ok: true,
        matched: false,
        reply: `Done. **$${fmt(amount)}** is now earning in **${draft.poolName}** at about ${draft.apy.toFixed(1)}% a year (about $${fmt(yr)}). Your balance there is $${fmt(principal)}. You can withdraw anytime.`,
        receipt: {
          kind: "earn",
          title: "Added to savings",
          status: "done",
          lines: [
            { label: "Pool", value: draft.poolName },
            { label: "Deposited", value: `$${fmt(amount)}` },
            { label: "APY", value: `${draft.apy.toFixed(1)}%` },
            { label: "Projected / yr", value: `$${fmt(yr)}` },
          ],
          reference: `EARN-${draft.poolId}`,
        },
      };
    }
    // Withdraw.
    emitStep(onProgress, "earn", 1);
    const ok = await earnWithdraw(account, draft.poolId);
    emitStep(onProgress, "earn", 2);
    if (!ok) return { ok: false, reply: "I couldn't find that savings position to withdraw." };
    return {
      ok: true,
      matched: false,
      reply: `Done. I withdrew everything from **${draft.poolName}** back to your balance.`,
      receipt: {
        kind: "earn",
        title: "Withdrew from savings",
        status: "done",
        lines: [
          { label: "Pool", value: draft.poolName },
          { label: "Status", value: "Withdrawn" },
        ],
      },
    };
  } catch {
    return { ok: false, reply: "That savings action didn't go through. Try again in a moment." };
  }
}

// ---- execution helpers (shared by direct + confirmed paths) ----------------

async function execBill(
  draft: Extract<AgentDraft, { type: "bill" }>,
  account: string,
  onProgress?: OnProgress,
): Promise<AgentTurnResult> {
  try {
    emitStep(onProgress, "bill", 0);
    emitStep(onProgress, "bill", 1);
    const result = await getBillsAdapter().purchase({
      category: draft.category as BillCategory,
      operatorId: draft.operatorId,
      customer: draft.customer,
      amount: draft.category === "data" ? undefined : draft.amount,
      planId: draft.planId,
      meterType: draft.meterType as MeterType | undefined,
    });
    emitStep(onProgress, "bill", 2);
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
  onProgress?: OnProgress,
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
    emitStep(onProgress, "transfer", 0);
    const submitTx = await submitIntentOn(chain, {
      tokenIn: from.address,
      tokenOut: to.address,
      amountIn: draft.amount,
      minAmountOut: minOut,
      recipient,
      ref: `AGENT-${from.code}-${to.code}`,
    });

    emitStep(onProgress, "transfer", 1);
    const outcome = await runEvmSolver(chain);
    const didSettle = outcome.settled.length > 0;
    emitStep(onProgress, "transfer", 2);

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
        txHash: submitTx,
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
