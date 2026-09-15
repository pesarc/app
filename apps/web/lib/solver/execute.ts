// Solver execution (Engineering Spec §3.5 "Solver / matcher"). Shared by the
// on-demand route and the cron so there is exactly one settlement path.
//
// The solver is untrusted with funds: it supplies no addresses and the contract
// enforces every maker's own limit, so the worst a stale plan can do is revert
// (and we simulate first, so it usually doesn't even cost gas).

import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { HUB_CHAIN, hubRpcUrl } from "@/lib/chain/chains";
import { CONTRACTS } from "@/lib/chain/contracts";
import { intentMatcherAbi } from "@/lib/chain/abi/intentMatcher";
import { findPlans, type Intent, type RingPlan } from "./matching";

export type SolveResult = {
  openIntents: number;
  settled: { kind: string; ids: string[]; tx: string }[];
  skipped: { ids: string[]; reason: string }[];
};

const matcher = () => CONTRACTS.intentMatcher as `0x${string}`;

export function solverConfigured(): boolean {
  return Boolean(CONTRACTS.intentMatcher);
}

export function publicHubClient() {
  return createPublicClient({ chain: HUB_CHAIN, transport: http(hubRpcUrl()) });
}

/** Reads every intent from the matcher (v0: full scan; index by event later). */
export async function loadIntents(
  client: ReturnType<typeof publicHubClient>,
): Promise<Intent[]> {
  const count = (await client.readContract({
    address: matcher(),
    abi: intentMatcherAbi,
    functionName: "intentCount",
  })) as bigint;

  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
  const rows = await Promise.all(
    ids.map(
      (id) =>
        client.readContract({
          address: matcher(),
          abi: intentMatcherAbi,
          functionName: "intents",
          args: [id],
        }) as Promise<
          readonly [
            string, string, string, string, bigint, bigint, bigint, bigint, boolean,
          ]
        >,
    ),
  );

  return rows.map((r, i) => ({
    id: ids[i],
    tokenIn: r[2],
    tokenOut: r[3],
    amountIn: r[4],
    minAmountOut: r[5],
    remainingIn: r[6],
    expiry: Number(r[7]),
    active: r[8],
  }));
}

function planCall(p: RingPlan) {
  return p.size === 2
    ? { fn: "matchIntents" as const, args: [p.ids[0], p.ids[1], p.fills[0], p.fills[1]] }
    : { fn: "matchRing" as const, args: [p.ids, p.fills] };
}

/** Scans open intents and settles everything that clears. */
export async function runSolver(): Promise<SolveResult> {
  const pk = process.env.SETTLE_OPERATOR_PK;
  if (!pk) throw new Error("Solver key not configured");

  const transport = http(hubRpcUrl());
  const client = createPublicClient({ chain: HUB_CHAIN, transport });
  const account = privateKeyToAccount(
    (pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`,
  );
  const wallet = createWalletClient({ account, chain: HUB_CHAIN, transport });

  const intents = await loadIntents(client);
  const now = Math.floor(Date.now() / 1000);
  const plans = findPlans(intents, now);

  const settled: SolveResult["settled"] = [];
  const skipped: SolveResult["skipped"] = [];

  for (const p of plans) {
    const { fn, args } = planCall(p);
    const kind = p.size === 2 ? "pair" : `ring-${p.size}`;
    try {
      // Simulate first so a stale plan never burns gas on a revert.
      await client.simulateContract({
        address: matcher(),
        abi: intentMatcherAbi,
        functionName: fn,
        args: args as never,
        account,
      });
      const tx = await wallet.writeContract({
        address: matcher(),
        abi: intentMatcherAbi,
        functionName: fn,
        args: args as never,
      });
      await client.waitForTransactionReceipt({ hash: tx, timeout: 30_000 });
      settled.push({ kind, ids: p.ids.map(String), tx });
    } catch (e) {
      skipped.push({
        ids: p.ids.map(String),
        reason: e instanceof Error ? e.message.slice(0, 80) : "failed",
      });
    }
  }

  return {
    openIntents: intents.filter((i) => i.active && i.expiry > now).length,
    settled,
    skipped,
  };
}

/** Dry run: what would clear right now, without spending anything. */
export async function previewSolver() {
  const client = publicHubClient();
  const intents = await loadIntents(client);
  const now = Math.floor(Date.now() / 1000);
  const plans = findPlans(intents, now);
  return {
    openIntents: intents.filter((i) => i.active && i.expiry > now).length,
    plans: plans.map((p) => ({
      kind: p.size === 2 ? "pair" : `ring-${p.size}`,
      ids: p.ids.map(String),
      fills: p.fills.map(String),
    })),
  };
}
