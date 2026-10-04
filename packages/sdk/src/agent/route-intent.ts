// "Route USDC across Arc to Arbitrum to Base to Arc" — a MULTI-HOP cross-chain
// move naming three or more chains in sequence (two or more legs), possibly a
// loop. Distinct from swap-intent (exactly two chains, one hop): a route is run
// leg by leg, each leg waiting for CCTP settlement before the next. The agent
// plans it here; the browser executes it (the smart wallet signs each leg), so
// this parser is pure and returns the ordered plan.
//
// Returns null for fewer than three chains, so a single hop still falls to
// swap-intent, and non-moves fall through to the LLM path.

export type RoutePlan = {
  /** Only USDC rides the CCTP route rail. */
  token: "USDC";
  /** Amount to send into the first leg. */
  amount?: number;
  /** Ordered chain labels, length >= 3 (>= 2 legs); repeats allowed for a loop. */
  chains: string[];
};

// CCTP-capable chains the route can hop across, friendly label -> matcher.
const CHAINS: { name: string; re: RegExp }[] = [
  { name: "Arc", re: /\barc\b/ },
  { name: "Base", re: /\bbase\b/ },
  { name: "Arbitrum", re: /\b(arbitrum|arb)\b/ },
  { name: "Optimism", re: /\b(optimism|op)\b/ },
  { name: "Polygon", re: /\b(polygon|matic)\b/ },
  { name: "Avalanche", re: /\b(avalanche|avax)\b/ },
  { name: "Ethereum", re: /\b(ethereum|eth)\b/ },
  { name: "Solana", re: /\b(solana|sol)\b/ },
];

const MOVE_VERB = /\b(route|swap|move|bridge|send|change|turn|convert|hop|loop|cycle|across)\b/;

/** The first chain named in a slice of text, in CHAINS order, or null. */
function chainIn(text: string): string | null {
  // Prefer the earliest-positioned match so "from base" picks Base, not a later
  // word; ties break on CHAINS order.
  let best: { name: string; i: number } | null = null;
  for (const c of CHAINS) {
    const i = text.search(c.re);
    if (i >= 0 && (!best || i < best.i)) best = { name: c.name, i };
  }
  return best?.name ?? null;
}

export function parseRouteIntent(message: string): RoutePlan | null {
  const m = message.toLowerCase();
  if (!MOVE_VERB.test(m)) return null;

  // Split on the connectors people use to chain hops, keeping segment order.
  const segments = m.split(/\s+to\s+|\s*→\s*|\s*,\s*|\s+then\s+|\s*->\s*/);
  const chains: string[] = [];
  for (const seg of segments) {
    const c = chainIn(seg);
    if (c) chains.push(c);
  }
  // Collapse an accidental immediate repeat (same chain twice in a row is a
  // no-op leg), but keep a genuine return hop (A … B … A).
  const cleaned = chains.filter((c, i) => i === 0 || c !== chains[i - 1]);
  if (cleaned.length < 3) return null;

  const num = (message.replace(/,/g, "").match(/\d+(\.\d+)?/) || [])[0];
  const amount = num ? Number(num) : undefined;
  return { token: "USDC", amount, chains: cleaned };
}

/** The agent's reply for a parsed route: the plan laid out, ready for the browser
 *  to run leg by leg. Kept here so run.ts stays lean. */
export function routePlanReply(plan: RoutePlan): { reply: string; understood: string } {
  const legs = plan.chains.length - 1;
  const path = plan.chains.join(" → ");
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const amt = plan.amount ? `**${fmt(plan.amount)} USDC**` : "**USDC**";
  const reply = [
    "Here's the route I'll run for you:",
    "",
    "| | |",
    "| --- | --- |",
    `| **Path** | ${path} |`,
    `| **Hops** | ${legs} |`,
    `| **Asset** | ${amt} |`,
    "",
    "I'll move it one hop at a time, wait for each transfer to settle on-chain, and show you the transaction for every leg. Signed in your wallet, fees paid in USDC.",
  ].join("\n");
  return { reply, understood: `Route ${plan.token} ${path}` };
}
