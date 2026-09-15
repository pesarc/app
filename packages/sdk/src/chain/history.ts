// Real on-chain activity for a wallet: ERC-20 Transfer events on the two
// corridor tokens (test USD + cNGN) from the hub deployment onward.
// Read-only via the hub public client — safe in client or server.

import { parseAbiItem, formatUnits } from "viem";
import { getLogsClient } from "./chains";
import { CONTRACTS, CONTRACTS_READY } from "./contracts";

export type OnchainActivity = {
  id: string;
  kind: "sent" | "received";
  /** Display symbol, e.g. "USDC" / "cNGN". */
  symbol: string;
  amount: number;
  /** Friendly counterparty label (contract name or short address). */
  counterparty: string;
  txHash: `0x${string}`;
  blockNumber: bigint;
  /** Unix seconds; present once block timestamps resolve. */
  timestamp?: number;
};

const TRANSFER = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

/** Known protocol addresses → friendly labels for the activity feed. */
function friendly(addr: string): string {
  const a = addr.toLowerCase();
  if (a === CONTRACTS.poolManager.toLowerCase()) return "Corridor swap";
  if (a === CONTRACTS.swapRouter.toLowerCase()) return "Corridor swap";
  if (a === CONTRACTS.safetyModule.toLowerCase()) return "Safety module";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Fetches the wallet's transfer history on both corridor tokens.
 * Returns newest-first, capped at `limit`; [] when unavailable.
 */
export async function fetchOnchainActivity(
  owner: `0x${string}`,
  limit = 12
): Promise<OnchainActivity[]> {
  if (!CONTRACTS_READY || !CONTRACTS.tokenNgn) return [];

  const client = getLogsClient();
  const tokens: { address: `0x${string}`; symbol: string }[] = [
    { address: CONTRACTS.tokenUsd as `0x${string}`, symbol: "USDC" },
    { address: CONTRACTS.tokenNgn as `0x${string}`, symbol: "cNGN" },
  ];

  try {
    const fromBlock = CONTRACTS.deployBlock;
    const batches = await Promise.all(
      tokens.flatMap((t) => [
        client.getLogs({
          address: t.address,
          event: TRANSFER,
          args: { from: owner },
          fromBlock,
        }),
        client.getLogs({
          address: t.address,
          event: TRANSFER,
          args: { to: owner },
          fromBlock,
        }),
      ])
    );

    const items: OnchainActivity[] = [];
    batches.forEach((logs, i) => {
      const token = tokens[Math.floor(i / 2)];
      for (const log of logs) {
        const from = log.args.from as `0x${string}`;
        const to = log.args.to as `0x${string}`;
        if (from.toLowerCase() === to.toLowerCase()) continue;
        const sent = from.toLowerCase() === owner.toLowerCase();
        items.push({
          id: `${log.transactionHash}-${log.logIndex}`,
          kind: sent ? "sent" : "received",
          symbol: token.symbol,
          amount: Number(formatUnits(log.args.value as bigint, 18)),
          counterparty: friendly(sent ? to : from),
          txHash: log.transactionHash as `0x${string}`,
          blockNumber: log.blockNumber,
        });
      }
    });

    items.sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : 1));
    const top = items.slice(0, limit);

    // Resolve timestamps for the blocks in view (deduped).
    const blocks = [...new Set(top.map((i) => i.blockNumber))];
    const stamps = new Map<bigint, number>();
    await Promise.all(
      blocks.map(async (bn) => {
        try {
          const b = await client.getBlock({ blockNumber: bn });
          stamps.set(bn, Number(b.timestamp));
        } catch {
          /* leave undefined */
        }
      })
    );
    for (const i of top) i.timestamp = stamps.get(i.blockNumber);
    return top;
  } catch {
    return [];
  }
}
