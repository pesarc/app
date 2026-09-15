// The settlement agent's "brain": turns a plain-language request into a
// structured cross-border settlement intent, then the on-chain solver-agent
// executes it. "Agents at Work" — an AI agent doing real payment work.
//
// Model-agnostic: the understanding runs through lib/llm/extract, which works
// with any OpenAI-compatible provider (Cencori, OpenAI, Groq, Ollama…) or
// native Anthropic — chosen entirely by env. No hard dependency on one model.

import { extractTool, type ToolSpec } from "@/lib/llm/extract";
import { celoCurrencies } from "./config";

export type ParsedIntent = {
  fromCode: string;
  toCode: string;
  /** Amount of the FROM currency the sender is sending. */
  amount: number;
  /** Recipient EVM address, or null if the user didn't give one. */
  recipient: string | null;
  /** The agent's short, human confirmation of what it understood. */
  summary: string;
};

export type AgentReply =
  | { ok: true; intent: ParsedIntent }
  | { ok: false; message: string };

const SYSTEM = `You are StableArc's settlement agent on Celo. You move money
between African local currencies (stablecoins) with no US dollar in the path —
matched peer-to-peer against opposing flow.

Your job: read the user's plain-language request and extract a single
cross-border settlement intent. Supported currencies are provided each turn.

Rules:
- The sender's amount is always in the FROM currency.
- If the user names a country instead of a currency, map it (Nigeria=NGN,
  Ghana=GHS/cedi, Kenya=KES/shilling).
- recipient must be a 0x EVM address if present; otherwise null.
- If the request is missing the amount, the from-currency, or the to-currency,
  do NOT guess — call needs_clarification with a brief question.
- Never invent a recipient address.`;

const tools: ToolSpec[] = [
  {
    name: "create_settlement_intent",
    description:
      "Create a cross-border settlement intent once amount, from-currency and to-currency are all known.",
    parameters: {
      type: "object",
      properties: {
        fromCode: { type: "string", description: "ISO code of the currency the sender sends, e.g. NGN" },
        toCode: { type: "string", description: "ISO code the recipient receives, e.g. GHS" },
        amount: { type: "number", description: "Amount in the FROM currency" },
        recipient: { type: ["string", "null"], description: "Recipient 0x EVM address, or null" },
        summary: { type: "string", description: "One short sentence confirming what you understood" },
      },
      required: ["fromCode", "toCode", "amount", "summary"],
    },
  },
  {
    name: "needs_clarification",
    description: "Use when the request is missing amount, from-currency, or to-currency.",
    parameters: {
      type: "object",
      properties: { question: { type: "string", description: "A brief question for the missing piece" } },
      required: ["question"],
    },
  },
];

/** Parses one user message into an intent (or a clarifying question). */
export async function parseSettlementRequest(message: string): Promise<AgentReply> {
  const supported = celoCurrencies()
    .map((c) => `${c.code} (${c.name}${c.flag})`)
    .join(", ");

  let call;
  try {
    call = await extractTool(SYSTEM, `Supported currencies: ${supported}.\n\nRequest: ${message}`, tools);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message.slice(0, 160) : "The agent had trouble." };
  }

  if (call.name === "needs_clarification") {
    const q = (call.input.question as string) ?? "Could you add a bit more detail?";
    return { ok: false, message: q };
  }

  const i = call.input as {
    fromCode?: string;
    toCode?: string;
    amount?: number;
    recipient?: string | null;
    summary?: string;
  };
  const from = i.fromCode?.toUpperCase();
  const to = i.toCode?.toUpperCase();
  if (!from || !to || from === to || !(typeof i.amount === "number" && i.amount > 0)) {
    return { ok: false, message: "I need a valid amount and two different currencies to settle between." };
  }
  const recipient =
    i.recipient && /^0x[0-9a-fA-F]{40}$/.test(i.recipient) ? i.recipient : null;

  return {
    ok: true,
    intent: { fromCode: from, toCode: to, amount: i.amount, recipient, summary: i.summary ?? "" },
  };
}
