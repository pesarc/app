// Real on-chain activity for a wallet, ACROSS every chain it holds balances on.
// Uses Alchemy's getAssetTransfers where the chain's RPC is Alchemy (one call per
// direction, no block-range juggling), and falls back to getLogs on chains that
// aren't Alchemy (e.g. Arc). Each item is tagged with the chain it happened on.
// Read-only; safe in client or server.

import { parseAbiItem, formatUnits } from "viem";
import { balanceChains, publicClientFor, type EvmChainConfig } from "./registry";

export type OnchainActivity = {
  id: string;
  kind: "sent" | "received";
  /** Display symbol, e.g. "USDC" / "cNGN". */
  symbol: string;
  amount: number;
  /** Friendly counterparty label (short address). */
  counterparty: string;
  txHash: `0x${string}`;
  /** Unix seconds, for cross-chain sorting. */
  timestamp?: number;
  chainKey: string;
  chainLabel: string;
  /** Whether the chain is a testnet (for the testnet/mainnet filter). */
  testnet: boolean;
  explorer?: string;
};

const TRANSFER = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** code -> display symbol for our tokens. */
function symbolFor(code: string): string {
  return code === "USD" ? "USDC" : `c${code}`;
}

/** Contract-address -> symbol map for a chain's configured tokens. */
function tokenMap(chain: EvmChainConfig): Map<string, string> {
  const m = new Map<string, string>();
  for (const [code, addr] of Object.entries(chain.tokens)) {
    if (addr) m.set((addr as string).toLowerCase(), symbolFor(code));
  }
  return m;
}

function explorerBase(chain: EvmChainConfig): string {
  return chain.chain.blockExplorers?.default?.url?.replace(/\/$/, "") ?? "";
}

// ---- Alchemy path (getAssetTransfers) ---------------------------------------

type AlchemyTransfer = {
  hash: string;
  from: string;
  to: string;
  value: number | null;
  asset: string | null;
  rawContract?: { address?: string };
  metadata?: { blockTimestamp?: string };
};

async function alchemyTransfers(
  chain: EvmChainConfig,
  owner: `0x${string}`,
  contracts: `0x${string}`[],
): Promise<OnchainActivity[]> {
  const map = tokenMap(chain);
  const base = explorerBase(chain);
  const call = async (dir: "from" | "to") => {
    const params: Record<string, unknown> = {
      category: ["erc20"],
      contractAddresses: contracts,
      withMetadata: true,
      excludeZeroValue: true,
      maxCount: "0x28", // 40
      order: "desc",
    };
    if (dir === "from") params.fromAddress = owner;
    else params.toAddress = owner;
    const res = await fetch(chain.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "alchemy_getAssetTransfers", params: [params] }),
    });
    const j = (await res.json()) as { result?: { transfers?: AlchemyTransfer[] } };
    return j.result?.transfers ?? [];
  };

  const [sent, recv] = await Promise.all([call("from"), call("to")]);
  const items: OnchainActivity[] = [];
  for (const [dir, list] of [["sent", sent], ["received", recv]] as const) {
    for (const t of list) {
      if (!t.hash || t.value == null) continue;
      const other = dir === "sent" ? t.to : t.from;
      const ca = t.rawContract?.address?.toLowerCase();
      const ts = t.metadata?.blockTimestamp ? Math.floor(Date.parse(t.metadata.blockTimestamp) / 1000) : undefined;
      items.push({
        id: `${t.hash}-${dir}-${other}`,
        kind: dir,
        symbol: (ca && map.get(ca)) || t.asset || "?",
        amount: Number(t.value),
        counterparty: short(other),
        txHash: t.hash as `0x${string}`,
        timestamp: ts,
        chainKey: chain.key,
        chainLabel: chain.label,
        testnet: chain.testnet,
        explorer: base ? `${base}/tx/${t.hash}` : undefined,
      });
    }
  }
  return items;
}

// ---- getLogs fallback (non-Alchemy chains, e.g. Arc) ------------------------

async function logsTransfers(
  chain: EvmChainConfig,
  owner: `0x${string}`,
  contracts: `0x${string}`[],
): Promise<OnchainActivity[]> {
  const client = publicClientFor(chain);
  const map = tokenMap(chain);
  const base = explorerBase(chain);
  const latest = await client.getBlockNumber();
  // Bound the range so an RPC with a getLogs cap doesn't reject it.
  const fromBlock = latest > 90_000n ? latest - 90_000n : 0n;

  const batches = await Promise.all(
    contracts.flatMap((address) => [
      client.getLogs({ address, event: TRANSFER, args: { from: owner }, fromBlock, toBlock: latest }),
      client.getLogs({ address, event: TRANSFER, args: { to: owner }, fromBlock, toBlock: latest }),
    ]),
  );

  const items: OnchainActivity[] = [];
  const blocks = new Set<bigint>();
  batches.forEach((logs) => {
    for (const log of logs) {
      const from = log.args.from as `0x${string}`;
      const to = log.args.to as `0x${string}`;
      if (from.toLowerCase() === to.toLowerCase()) continue;
      const sent = from.toLowerCase() === owner.toLowerCase();
      const ca = (log.address as string).toLowerCase();
      blocks.add(log.blockNumber);
      items.push({
        id: `${log.transactionHash}-${log.logIndex}`,
        kind: sent ? "sent" : "received",
        symbol: map.get(ca) ?? "?",
        amount: Number(formatUnits(log.args.value as bigint, 18)),
        counterparty: short(sent ? to : from),
        txHash: log.transactionHash as `0x${string}`,
        timestamp: undefined,
        chainKey: chain.key,
        chainLabel: chain.label,
        testnet: chain.testnet,
        explorer: base ? `${base}/tx/${log.transactionHash}` : undefined,
      });
      // stash the block on the item id for the timestamp pass
      (items[items.length - 1] as { _bn?: bigint })._bn = log.blockNumber;
    }
  });

  // Resolve timestamps for the blocks actually in view.
  const stamps = new Map<bigint, number>();
  await Promise.all(
    [...blocks].map(async (bn) => {
      try {
        const b = await client.getBlock({ blockNumber: bn });
        stamps.set(bn, Number(b.timestamp));
      } catch {
        /* leave undefined */
      }
    }),
  );
  for (const it of items) {
    const bn = (it as { _bn?: bigint })._bn;
    if (bn != null) it.timestamp = stamps.get(bn);
    delete (it as { _bn?: bigint })._bn;
  }
  return items;
}

/**
 * A wallet's recent transfer history across every chain it holds tokens on,
 * newest first, capped at `limit`. Best-effort per chain: one chain failing
 * (RPC down, unsupported method) never aborts the others.
 */
export async function fetchOnchainActivity(
  owner: `0x${string}`,
  limit = 12,
): Promise<OnchainActivity[]> {
  const chains = balanceChains().filter((c) => Object.keys(c.tokens).length > 0);

  const perChain = await Promise.all(
    chains.map(async (chain) => {
      const contracts = Object.values(chain.tokens).filter(Boolean) as `0x${string}`[];
      if (!contracts.length) return [];
      try {
        return chain.rpcUrl.includes("alchemy")
          ? await alchemyTransfers(chain, owner, contracts)
          : await logsTransfers(chain, owner, contracts);
      } catch {
        return [];
      }
    }),
  );

  const all = perChain.flat();
  all.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  return all.slice(0, limit);
}
