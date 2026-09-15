// Pure matching logic for the Pesarc solver (docs/LOCAL_CURRENCY_SETTLEMENT.md §2.1).
//
// Given the open intents, find settlements that clear **local-to-local with no
// outside liquidity**: direct 2-party pairs first, then longer rings
// (GHS→NGN→KES→GHS) for flows that have no direct counterparty.
//
// No chain access here on purpose — this is deterministic and unit-testable.
// The solver can never redirect funds or breach a limit (the contract enforces
// both); the worst a bad plan can do is revert.

export type Intent = {
  id: bigint;
  tokenIn: string;
  tokenOut: string;
  /** Original input amount — fixes the limit rate across partial fills. */
  amountIn: bigint;
  /** Minimum total output for `amountIn`. */
  minAmountOut: bigint;
  /** Input still unfilled. */
  remainingIn: bigint;
  expiry: number;
  active: boolean;
};

/** A settlement the solver proposes: ids in cycle order + each one's fill. */
export type RingPlan = {
  ids: bigint[];
  fills: bigint[];
  /** 2 = direct pair, 3+ = ring. */
  size: number;
};

const WAD = 10n ** 18n;

/** The maker's limit rate: tokenOut per tokenIn, 1e18-scaled. */
export function limitRate(i: Intent): bigint {
  if (i.amountIn === 0n) return 0n;
  return (i.minAmountOut * WAD) / i.amountIn;
}

function isLive(i: Intent, now: number): boolean {
  return i.active && i.remainingIn > 0n && i.expiry > now;
}

const key = (a: string, b: string) => `${a.toLowerCase()}->${b.toLowerCase()}`;

/**
 * Finds cycles up to `maxRing` in the intent graph (tokenIn → tokenOut) and
 * returns executable plans, best (shortest) first. Intents already committed to
 * a plan in this batch are not reused, so plans in one batch never conflict.
 */
export function findPlans(
  intents: Intent[],
  now: number = Math.floor(Date.now() / 1000),
  maxRing = 4,
): RingPlan[] {
  const live = intents.filter((i) => isLive(i, now));
  const used = new Set<string>();
  const plans: RingPlan[] = [];

  // Index by the leg an intent supplies: tokenIn -> tokenOut.
  const byLeg = new Map<string, Intent[]>();
  for (const i of live) {
    const k = key(i.tokenIn, i.tokenOut);
    (byLeg.get(k) ?? byLeg.set(k, []).get(k)!).push(i);
  }

  // Shortest rings first: a direct pair is cheaper and likelier to clear.
  for (let size = 2; size <= maxRing; size++) {
    for (const start of live) {
      if (used.has(start.id.toString())) continue;
      const cycle = searchCycle(start, byLeg, used, size, now);
      if (!cycle) continue;
      const plan = planFills(cycle);
      if (!plan) continue;
      for (const i of cycle) used.add(i.id.toString());
      plans.push(plan);
    }
  }
  return plans;
}

/** Depth-first walk for a cycle of exactly `size` returning to `start.tokenIn`. */
function searchCycle(
  start: Intent,
  byLeg: Map<string, Intent[]>,
  used: Set<string>,
  size: number,
  now: number,
): Intent[] | null {
  const path: Intent[] = [start];
  const inPath = new Set<string>([start.id.toString()]);

  const walk = (): Intent[] | null => {
    const cur = path[path.length - 1];
    if (path.length === size) {
      // Closed only if the last leg feeds the first intent's tokenIn.
      return cur.tokenOut.toLowerCase() === start.tokenIn.toLowerCase()
        ? [...path]
        : null;
    }
    // Candidates supplying what `cur` wants.
    for (const [k, list] of byLeg) {
      if (!k.startsWith(`${cur.tokenOut.toLowerCase()}->`)) continue;
      for (const next of list) {
        const id = next.id.toString();
        if (used.has(id) || inPath.has(id) || !isLive(next, now)) continue;
        path.push(next);
        inPath.add(id);
        const found = walk();
        if (found) return found;
        path.pop();
        inPath.delete(id);
      }
    }
    return null;
  };

  return walk();
}

/**
 * Sizes a cycle and prices it.
 *
 * Fills are chained: intent i receives fills[i+1]. We seed with intent 0's
 * remaining, propagate around the ring at each maker's *limit* rate, then
 * scale everything down to whatever the tightest intent can actually supply.
 * Finally we verify the cycle closes at or above every limit — a ring only
 * clears if the rates multiply to ≥ 1 round-trip (i.e. it's arbitrage-free
 * from every participant's own stated price).
 *
 * Returns null when the cycle can't clear within everyone's limits.
 */
function planFills(cycle: Intent[]): RingPlan | null {
  const n = cycle.length;

  // Relative fills, anchored at 1 WAD of intent 0's input.
  const rel: bigint[] = new Array(n).fill(0n);
  rel[0] = WAD;
  for (let i = 0; i < n - 1; i++) {
    const r = limitRate(cycle[i]); // tokenOut per tokenIn
    if (r === 0n) return null;
    // Intent i gives rel[i] and must receive >= rel[i] * rate.
    rel[i + 1] = (rel[i] * r) / WAD;
    if (rel[i + 1] === 0n) return null;
  }
  // Closing check: the last leg must return enough to satisfy intent n-1's
  // limit against intent 0's supply.
  const lastRate = limitRate(cycle[n - 1]);
  const closing = (rel[n - 1] * lastRate) / WAD;
  if (closing > rel[0]) return null; // rates don't close — no feasible ring

  // Scale so no intent exceeds its remaining balance.
  let scale = WAD * WAD; // large; we take the min ratio
  for (let i = 0; i < n; i++) {
    const s = (cycle[i].remainingIn * WAD) / rel[i];
    if (s < scale) scale = s;
  }
  if (scale === 0n) return null;

  const fills = rel.map((r) => (r * scale) / WAD);
  if (fills.some((f) => f <= 0n)) return null;
  for (let i = 0; i < n; i++) if (fills[i] > cycle[i].remainingIn) return null;

  // Final guard: re-check every maker's pro-rata limit exactly as the contract
  // will, so we never submit a plan that reverts.
  for (let i = 0; i < n; i++) {
    const gives = fills[i];
    const gets = fills[(i + 1) % n];
    if (gets * cycle[i].amountIn < cycle[i].minAmountOut * gives) return null;
  }

  return { ids: cycle.map((i) => i.id), fills, size: n };
}
