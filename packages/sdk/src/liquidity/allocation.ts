// Vault -> market allocation PLANNER (pure, isomorphic). Given the vault's idle
// cash, the buffer it must keep for withdrawals, and a set of target markets
// (strategy adapters) with weights, it computes how much to put to work in each.
// The CorridorVault keeps >= (1 - maxDeployBps) of TVL idle, so we only ever plan
// to deploy the headroom above that buffer. No funds move here; the operator
// executes the plan (vault-allocate.ts / scripts/vault-allocate.mjs).

export type AllocationTarget = {
  /** The strategy adapter (the "market" wrapper) the vault allocates into. */
  address: `0x${string}`;
  /** Relative weight in basis points of the deployable amount. */
  weightBps: number;
  /** Human label for the UI / logs (e.g. "Aave USDC"). */
  label?: string;
};

export type Allocation = { address: `0x${string}`; label?: string; amount: bigint };

/** Deployable headroom = idle minus the buffer the vault must keep idle.
 *  minIdle = totalAssets * (BPS - maxDeployBps) / BPS (mirrors the contract). */
export function deployableHeadroom(idle: bigint, totalAssets: bigint, maxDeployBps: number): bigint {
  const BPS = 10_000n;
  const minIdle = (totalAssets * (BPS - BigInt(maxDeployBps))) / BPS;
  const free = idle - minIdle;
  return free > 0n ? free : 0n;
}

/**
 * Split `deployable` across the targets by weight. Weightless targets are
 * ignored; the last funded target absorbs the rounding dust so the sum never
 * exceeds `deployable`. Returns only non-zero allocations.
 */
export function planAllocations(deployable: bigint, targets: AllocationTarget[]): Allocation[] {
  if (deployable <= 0n) return [];
  const live = targets.filter((t) => t.weightBps > 0);
  const totalW = live.reduce((s, t) => s + BigInt(t.weightBps), 0n);
  if (totalW === 0n) return [];

  const out: Allocation[] = [];
  let used = 0n;
  live.forEach((t, i) => {
    const amount = i === live.length - 1 ? deployable - used : (deployable * BigInt(t.weightBps)) / totalW;
    if (amount > 0n) {
      out.push({ address: t.address, label: t.label, amount });
      used += amount;
    }
  });
  return out;
}

/** Equal-weight targets from a bare list of strategy addresses (the default
 *  platform policy when no explicit weights are configured). */
export function equalTargets(strategies: { address: `0x${string}`; label?: string }[]): AllocationTarget[] {
  const n = strategies.length;
  if (!n) return [];
  const w = Math.floor(10_000 / n);
  return strategies.map((s, i) => ({
    address: s.address,
    label: s.label,
    weightBps: i === n - 1 ? 10_000 - w * (n - 1) : w,
  }));
}

/** Optional per-chain weight overrides from env, as "addr:bps,addr:bps".
 *  Literal NEXT_PUBLIC refs so Next inlines them; unset -> equal weights. */
const WEIGHTS: Record<string, string | undefined> = {
  arc: process.env.NEXT_PUBLIC_ARC_VAULT_WEIGHTS,
  "arc-testnet": process.env.NEXT_PUBLIC_ARC_TESTNET_VAULT_WEIGHTS,
  base: process.env.NEXT_PUBLIC_BASE_VAULT_WEIGHTS,
  "base-sepolia": process.env.NEXT_PUBLIC_BASE_SEPOLIA_VAULT_WEIGHTS,
  arbitrum: process.env.NEXT_PUBLIC_ARBITRUM_VAULT_WEIGHTS,
  "arbitrum-sepolia": process.env.NEXT_PUBLIC_ARB_SEPOLIA_VAULT_WEIGHTS,
};

/** Parse a chain's configured weights into a lookup (lowercased address -> bps),
 *  or null when none are set (callers then fall back to equal weights). */
export function configuredWeights(chainKey: string): Map<string, number> | null {
  const raw = WEIGHTS[chainKey];
  if (!raw) return null;
  const map = new Map<string, number>();
  for (const part of raw.split(",")) {
    const [addr, bps] = part.split(":").map((s) => s.trim());
    if (/^0x[0-9a-fA-F]{40}$/.test(addr) && Number(bps) > 0) map.set(addr.toLowerCase(), Number(bps));
  }
  return map.size ? map : null;
}

/** Build targets for a chain: configured weights when present, else equal. */
export function targetsFor(
  chainKey: string,
  strategies: { address: `0x${string}`; label?: string }[],
): AllocationTarget[] {
  const weights = configuredWeights(chainKey);
  if (!weights) return equalTargets(strategies);
  return strategies
    .map((s) => ({ address: s.address, label: s.label, weightBps: weights.get(s.address.toLowerCase()) ?? 0 }))
    .filter((t) => t.weightBps > 0);
}
