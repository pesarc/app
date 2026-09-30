// "Put 100 into savings" / "earn on 50 USDC" / "withdraw my savings" / "how much
// am I earning?" — the Earn intents. Earn is a tracked corridor-pool ledger (no
// wallet signature), so the agent can act on it directly. Deposit and withdraw
// move money, so they draft for consent; positions is read-only.
//
// Requires an Earn context word so it never hijacks a bank cash-out ("withdraw
// 5,000 to my bank") or a market stake ("stake 20 on yes").

export type EarnIntent =
  | { action: "deposit"; amount?: number; query: string }
  | { action: "withdraw"; query: string }
  | { action: "positions" };

const CTX = /\b(save|saving|savings|earn|earning|yield|invest|investment|pool|apy|interest)\b/;
const WITHDRAW = /\b(withdraw|take out|pull out|redeem|cash in|exit|unstake)\b/;
const DEPOSIT = /\b(save|earn|deposit|invest|put|grow|add|move)\b/;
const POSITIONS =
  /\b(how much.*(earn|making|yield|grown)|my (savings|earnings?|positions?|investments?|yield)|what.*earning|am i earning)\b/;

export function parseEarnIntent(message: string): EarnIntent | null {
  const m = message.toLowerCase();
  if (!CTX.test(m)) return null;

  // Read-only positions, only when it isn't a move.
  if (POSITIONS.test(m) && !WITHDRAW.test(m) && !/\bdeposit\b/.test(m)) {
    return { action: "positions" };
  }

  if (WITHDRAW.test(m)) return { action: "withdraw", query: m };

  if (DEPOSIT.test(m)) {
    const num = (message.replace(/,/g, "").match(/\d+(\.\d+)?/) || [])[0];
    return { action: "deposit", amount: num ? Number(num) : undefined, query: m };
  }

  // A bare "my savings" with no verb -> treat as positions.
  return { action: "positions" };
}
