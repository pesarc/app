// "What's my balance?" / "check the balance of 0x…" — a read-only intent. The
// agent answers with real on-chain holdings; no money moves, so it needs no
// consent. An explicit 0x address is looked up as-is; otherwise the caller's own
// wallet is used.

export type BalanceIntent = { address?: `0x${string}` };

const EVM_ADDRESS = /0x[a-fA-F0-9]{40}/;

export function parseBalanceIntent(message: string): BalanceIntent | null {
  const m = message.toLowerCase();
  const asksBalance =
    /\b(balance|balances|holdings|how much (do|have|money|i)|what('?s| is| do i) (in|have)|my funds)\b/.test(m) ||
    (/\bcheck\b/.test(m) && /\b(wallet|address|0x[a-f0-9]{40})\b/.test(m));
  if (!asksBalance) return null;
  const addr = message.match(EVM_ADDRESS)?.[0] as `0x${string}` | undefined;
  return { address: addr };
}

/** "Show my recent activity" / "what did I send" / "transactions for 0x…" — also
 *  read-only. Reads recent on-chain transfers for the wallet. */
export type ActivityIntent = { address?: `0x${string}` };

export function parseActivityIntent(message: string): ActivityIntent | null {
  const m = message.toLowerCase();
  const asksActivity =
    /\b(activity|activities|transactions?|tx history|history|recent (sends|payments|transfers|activity)|what (have|did) i (send|sent|receive|received|do))\b/.test(
      m,
    );
  if (!asksActivity) return null;
  const addr = message.match(EVM_ADDRESS)?.[0] as `0x${string}` | undefined;
  return { address: addr };
}
