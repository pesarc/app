// LLM understanding layer for the agent.
//
// The agent's intent handlers are precise but literal regex parsers: they only
// fire on specific phrasings. This layer sits in front of them and uses the
// configured LLM to rewrite a user's free-text request into ONE canonical
// command those parsers reliably match, plus the action type. So "how do I
// change 1usdc on arc testnet to base testnet" becomes "swap 1 USDC from Arc to
// Base on testnet" and routes correctly, while "hi" stays as chat.
//
// It only ever REWRITES the user's own words into a cleaner command for the same
// handlers — it does not execute anything, invent amounts/recipients, or reach
// any data beyond the request. It is opt-in: with no LLM configured it is a
// no-op and the raw message flows to the regex parsers unchanged.

import { extractTool, llmConfigured } from "../llm/extract";

export type AgentAction =
  | "move" // cross-chain move / swap of a token between chains
  | "stake" // place a prediction-market stake
  | "send" // send money to a person / wallet / bank
  | "cashout" // withdraw to a bank / mobile money
  | "bill" // pay an electricity bill
  | "airtime"
  | "data"
  | "save" // put money into savings / earn
  | "withdraw" // take money out of savings
  | "balance"
  | "activity"
  | "create_market"
  | "other"; // greeting, question, or anything not a money action

export type Interpretation = { action: AgentAction; canonical: string };

const SYSTEM = [
  "You are the understanding layer for Pesarc, a cross-border money app.",
  "Translate the user's request into (1) an action type and (2) ONE short canonical",
  "command the app understands. Keep every concrete detail the user gave — amount,",
  "token (USDC/USDT/cNGN...), chains (Arc, Base, Arbitrum, Celo...), currency",
  "(naira/NGN, cedi/GHS, shilling/KES), recipient, bill type, and whether they said",
  "testnet or mainnet. NEVER invent an amount, recipient, or network the user did",
  "not state. If it is not a money action (a greeting, a question, small talk), use",
  'action "other" and return the user\'s message unchanged as the canonical command.',
  "",
  "Examples (input -> action | canonical):",
  '"how do i change 1usdc on arc testnet to base testnet" -> move | "swap 1 USDC from Arc to Base on testnet"',
  '"move 10 usdc arc to base to arbitrum" -> move | "route 10 USDC from Arc to Base to Arbitrum"',
  '"put 5k naira in savings" -> save | "save 5000 NGN"',
  '"take out my savings" -> withdraw | "withdraw savings"',
  '"how much do i have" -> balance | "balance"',
  '"what have i sent recently" -> activity | "activity"',
  '"send 20 cedis to 0244123456" -> send | "send 20 GHS to 0244123456"',
  '"cash out 15000 naira to my gtbank" -> cashout | "cash out 15000 NGN to bank"',
  '"i need 1gb mtn data" -> data | "buy 1GB MTN data"',
  '"top up 500 airtime" -> airtime | "buy 500 airtime"',
  '"pay my ikeja electric bill 2000" -> bill | "pay 2000 electricity bill"',
  '"stake 20 on yes for usd/ngn" -> stake | "stake 20 on Yes for USD/NGN"',
  '"create a market on who wins the election" -> create_market | "create a market: who wins the election"',
  '"hey there" -> other | "hey there"',
].join("\n");

const ACTIONS: AgentAction[] = [
  "move",
  "stake",
  "send",
  "cashout",
  "bill",
  "airtime",
  "data",
  "save",
  "withdraw",
  "balance",
  "activity",
  "create_market",
  "other",
];

/**
 * Rewrite a free-text message into a canonical command + action, using the LLM.
 * Returns null when no LLM is configured or the call fails — callers then use the
 * raw message, so the agent never regresses without the model.
 */
export async function interpretMessage(message: string): Promise<Interpretation | null> {
  if (!llmConfigured()) return null;
  try {
    const call = await extractTool(SYSTEM, message, [
      {
        name: "interpret",
        description: "Return the action type and a single canonical command string.",
        parameters: {
          type: "object",
          properties: {
            action: { type: "string", enum: ACTIONS },
            canonical: {
              type: "string",
              description: "One short imperative command capturing exactly what the user asked for.",
            },
          },
          required: ["action", "canonical"],
        },
      },
    ]);
    const action = (ACTIONS.includes(call.input.action as AgentAction)
      ? (call.input.action as AgentAction)
      : "other");
    const canonical = String(call.input.canonical ?? "").trim();
    if (!canonical) return null;
    return { action, canonical };
  } catch {
    return null; // model hiccup — fall back to the raw message
  }
}
