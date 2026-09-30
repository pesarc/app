// "Stake 20 on Yes for the USD/NGN market" / "bet 10 on Nigeria to reach the
// final" — a prediction-market stake. Staking is a real on-chain action that
// needs the user's smart wallet to sign, which lives in the browser, so the
// agent understands it, finds the market, and hands off to the Markets stake
// sheet to sign in-app. This parser just extracts the intent.

export type StakeIntent = {
  amount?: number;
  side: "yes" | "no";
  /** The market topic, for matching against live markets. */
  query: string;
};

const VERB = /\b(stake|bet|wager|predict)\b/;

export function parseStakeIntent(message: string): StakeIntent | null {
  const m = message.toLowerCase();
  if (!VERB.test(m)) return null;
  // Earn deposits also use "put/invest"; those carry an Earn context word and are
  // handled first, so by here a stake verb means a market bet.

  const side: "yes" | "no" = /\bno\b/.test(m) ? "no" : "yes";
  const num = (message.replace(/,/g, "").match(/\d+(\.\d+)?/) || [])[0];

  // Strip the staking scaffolding to leave the market topic.
  const query = m
    .replace(VERB, " ")
    .replace(/\b(\d+(\.\d+)?)\b/g, " ")
    .replace(/\b(on|the|a|for|to|yes|no|market|prediction|that|will|shares?|position)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { amount: num ? Number(num) : undefined, side, query };
}
