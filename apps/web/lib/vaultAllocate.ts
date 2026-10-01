// Shared server-side vault -> market allocation. Reads the CorridorVault, plans
// how much of the deployable headroom to put in each market (strategy), and —
// with execute — sends the operator allocate() transactions. Used by both the
// operator webhook (/api/earn/allocate) and the deposit-triggered auto-allocation
// (event-driven, no cron). Server only: it signs with the operator key.

import { createPublicClient, createWalletClient, http, encodeFunctionData, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chainByKey } from "@pesarc/sdk/chain/registry";
import { corridorVaultFor } from "@pesarc/sdk/chain/vault-write";
import { deployableHeadroom, targetsFor, planAllocations } from "@pesarc/sdk/liquidity/allocation";

const vaultAbi = [
  { type: "function", name: "idle", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalAssets", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "maxDeployBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "operator", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "strategies", stateMutability: "view", inputs: [{ name: "i", type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "allocate", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "a", type: "uint256" }], outputs: [] },
] as const;

export type AllocateResult = {
  ok: boolean;
  error?: string;
  dryRun?: boolean;
  vault?: string;
  chainKey?: string;
  tvl?: string;
  idle?: string;
  headroom?: string;
  operator?: string;
  plan?: { strategy: string; amount: string }[];
  executed?: { strategy: string; amount: string; tx: string }[];
  note?: string;
};

/**
 * Plan (and optionally execute) the allocation for one chain's vault.
 * execute requires SETTLE_OPERATOR_PK; mainnet additionally requires allowMainnet.
 */
export async function planAndAllocate(
  chainKey: string,
  opts: { execute?: boolean; allowMainnet?: boolean } = {},
): Promise<AllocateResult> {
  const cfg = chainByKey(chainKey);
  if (!cfg) return { ok: false, error: "Unknown chain.", chainKey };
  const vault = corridorVaultFor(chainKey);
  if (!vault) return { ok: false, error: "No vault for this chain.", chainKey };

  const pub = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpcUrl) });
  const read = (fn: string, args: readonly unknown[] = []) =>
    pub.readContract({ address: vault, abi: vaultAbi, functionName: fn as never, args: args as never });

  let idle: bigint, total: bigint, bps: bigint, dec: number, operator: `0x${string}`;
  try {
    [idle, total, bps, dec, operator] = (await Promise.all([
      read("idle"), read("totalAssets"), read("maxDeployBps"), read("decimals"), read("operator"),
    ])) as [bigint, bigint, bigint, number, `0x${string}`];
  } catch {
    return { ok: false, error: "Could not read the vault.", chainKey, vault };
  }
  const decimals = Number(dec);
  const fmt = (w: bigint) => formatUnits(w, decimals);

  const strategies: `0x${string}`[] = [];
  for (let i = 0; i < 10; i++) {
    try {
      strategies.push((await read("strategies", [BigInt(i)])) as `0x${string}`);
    } catch {
      break;
    }
  }

  const headroom = deployableHeadroom(idle, total, Number(bps));
  const targets = targetsFor(chainKey, strategies.map((address) => ({ address })));
  const plan = planAllocations(headroom, targets);
  const planOut = plan.map((a) => ({ strategy: a.address, amount: fmt(a.amount) }));
  const base: AllocateResult = { ok: true, vault, chainKey, tvl: fmt(total), idle: fmt(idle), headroom: fmt(headroom), operator, plan: planOut };

  if (!opts.execute) return { ...base, dryRun: true };
  if (!cfg.testnet && !opts.allowMainnet) return { ...base, ok: false, error: "Mainnet execution needs allowMainnet." };
  if (!plan.length) return { ...base, executed: [], note: "Nothing to allocate." };

  const pk = process.env.SETTLE_OPERATOR_PK;
  if (!pk) return { ...base, ok: false, error: "Operator key not configured." };
  const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`);
  if (account.address.toLowerCase() !== operator.toLowerCase()) {
    return { ...base, ok: false, error: "Configured key is not the vault operator." };
  }
  const wallet = createWalletClient({ account, chain: cfg.chain, transport: http(cfg.rpcUrl) });
  const executed: { strategy: string; amount: string; tx: string }[] = [];
  try {
    for (const a of plan) {
      const data = encodeFunctionData({ abi: vaultAbi, functionName: "allocate", args: [a.address, a.amount] });
      const tx = await wallet.sendTransaction({ to: vault, data });
      await pub.waitForTransactionReceipt({ hash: tx, timeout: 120_000 });
      executed.push({ strategy: a.address, amount: fmt(a.amount), tx });
    }
  } catch (e) {
    return { ...base, ok: false, error: e instanceof Error ? e.message : "Allocation failed.", executed };
  }
  return { ...base, executed };
}

// Per-chain debounce so a burst of deposits triggers at most one allocation run
// per window. Module-level: persists for the life of the server process.
const lastRun = new Map<string, number>();
const WINDOW_MS = 60_000;

/** Fire an allocation for a chain after a deposit, best-effort and debounced.
 *  Opt-in: AUTO_ALLOCATE=1 (testnet), plus AUTO_ALLOCATE_MAINNET=1 for mainnet.
 *  Never throws; returns whether a run was attempted. */
export async function autoAllocateOnDeposit(chainKey: string): Promise<boolean> {
  if (process.env.AUTO_ALLOCATE !== "1") return false;
  const cfg = chainByKey(chainKey);
  if (!cfg) return false;
  const allowMainnet = process.env.AUTO_ALLOCATE_MAINNET === "1";
  if (!cfg.testnet && !allowMainnet) return false;
  const now = Date.now();
  if (now - (lastRun.get(chainKey) ?? 0) < WINDOW_MS) return false;
  lastRun.set(chainKey, now);
  try {
    await planAndAllocate(chainKey, { execute: true, allowMainnet });
  } catch {
    /* best-effort: a failed sweep never breaks the deposit */
  }
  return true;
}
