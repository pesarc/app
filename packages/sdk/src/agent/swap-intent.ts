// "Swap / move / bridge <asset> from <chain> to <chain>" — a CROSS-CHAIN intent.
// Distinct from same-chain FX ("naira to cedis"): this one names two different
// chains, so it moves an asset across them. The agent can't sign a cross-chain
// move from chat (that needs the in-app smart wallet), so it understands the
// request, echoes it back clearly, and hands off to the Cross-chain screen.
//
// Returns null when the message isn't a cross-chain move, so same-chain FX and
// the LLM settlement path still get their turn.

export type SwapIntent = {
  /** Optional amount the user named. */
  amount?: number;
  /** Display token symbol, e.g. "USDC". */
  token: string;
  /** Source chain, friendly label ("Arc", "Base"). */
  from: string;
  /** Destination chain, friendly label. */
  to: string;
  /** Whether the user asked for testnet. */
  testnet: boolean;
};

// Friendly chain name -> the words that mean it. Order matters only for display.
const CHAINS: { name: string; re: RegExp }[] = [
  { name: "Arc", re: /\barc\b/ },
  { name: "Base", re: /\bbase\b/ },
  { name: "Arbitrum", re: /\b(arbitrum|arb)\b/ },
  { name: "Polygon", re: /\b(polygon|matic)\b/ },
  { name: "Optimism", re: /\b(optimism|op mainnet|op sepolia)\b/ },
  { name: "Avalanche", re: /\b(avalanche|avax)\b/ },
  { name: "Celo", re: /\bcelo\b/ },
  { name: "Ethereum", re: /\b(ethereum|mainnet eth|eth mainnet)\b/ },
];

const TOKENS: { symbol: string; re: RegExp }[] = [
  { symbol: "USDC", re: /\busdc\b/ },
  { symbol: "USDT", re: /\busdt\b/ },
  { symbol: "PYUSD", re: /\bpyusd\b/ },
  { symbol: "cNGN", re: /\b(cngn|ngn|naira)\b/ },
  { symbol: "cKES", re: /\b(ckes|kes|shilling|shillings)\b/ },
  { symbol: "cGHS", re: /\b(cghs|ghs|cedi|cedis)\b/ },
  { symbol: "cZAR", re: /\b(czar|zar|rand)\b/ },
  { symbol: "cEGP", re: /\b(cegp|egp|pound|pounds)\b/ },
];

const MOVE_VERB = /\b(swap|move|bridge|transfer|convert|shift|port|send)\b/;

/** First chain name found in a slice of text, or null. */
function chainIn(text: string): string | null {
  for (const c of CHAINS) if (c.re.test(text)) return c.name;
  return null;
}

export function parseSwapIntent(message: string): SwapIntent | null {
  const m = message.toLowerCase();
  const crossWord = /\bcross[-\s]?chain\b/.test(m);
  if (!MOVE_VERB.test(m) && !crossWord) return null;

  // Two distinct chains make it cross-chain. Prefer a clear "X … to … Y" split
  // so direction is right; fall back to first two distinct chains in order.
  let from: string | null = null;
  let to: string | null = null;
  const cut = m.lastIndexOf(" to ");
  if (cut !== -1) {
    from = chainIn(m.slice(0, cut));
    to = chainIn(m.slice(cut + 4));
  }
  if (!from || !to || from === to) {
    const seen: string[] = [];
    // Collect chains in order of appearance, deduped.
    const positions = CHAINS.map((c) => ({ name: c.name, i: m.search(c.re) }))
      .filter((p) => p.i >= 0)
      .sort((a, b) => a.i - b.i);
    for (const p of positions) if (!seen.includes(p.name)) seen.push(p.name);
    if (seen.length < 2) return null;
    from = seen[0];
    to = seen[1];
  }
  if (!from || !to || from === to) return null;

  const token = TOKENS.find((t) => t.re.test(m))?.symbol ?? "USDC";
  const testnet = /\b(testnet|sepolia|devnet|test net)\b/.test(m);
  const num = (message.replace(/,/g, "").match(/\d+(\.\d+)?/) || [])[0];
  const amount = num ? Number(num) : undefined;

  return { amount, token, from, to, testnet };
}

// Friendly chain label -> the Cross-chain screen's own chain key (CCTP keys,
// shared across testnet and mainnet). Only chains the bridge can pre-select are
// here; anything else is left for the user to pick. Celo has no CCTP corridor.
const CHAIN_KEY: Record<string, string> = {
  Arc: "arc",
  Base: "base",
  Arbitrum: "arbitrum",
  Polygon: "polygon",
  Optimism: "optimism",
  Avalanche: "avalanche",
  Ethereum: "ethereum",
};

/**
 * Deep link that lands the user on the Cross-chain screen with the move already
 * filled in — coin, from, to, amount and network — so it's one tap to sign.
 * Omits any field we can't map cleanly, so a partial intent still pre-fills what
 * it can rather than carrying a bad value.
 */
export function swapHandoffUrl(intent: SwapIntent): string {
  const p = new URLSearchParams({ tab: "crosschain" });
  p.set("coin", intent.token);
  const from = CHAIN_KEY[intent.from];
  const to = CHAIN_KEY[intent.to];
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  if (intent.amount && intent.amount > 0) p.set("amount", String(intent.amount));
  p.set("net", intent.testnet ? "testnet" : "mainnet");
  return `/swap?${p.toString()}`;
}
