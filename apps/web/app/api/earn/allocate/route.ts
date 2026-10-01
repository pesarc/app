// Operator endpoint: put the vault's idle deposits to work across its markets
// (strategy adapters). The vault pools everyone's deposits; this computes how much
// of the deployable headroom to allocate to each registered strategy (equal
// weights, or NEXT_PUBLIC_<PREFIX>_VAULT_WEIGHTS) and — only with execute:true and
// the operator secret — sends the on-chain allocate() transactions as the operator.
//
// Guards (this moves pooled funds): requires the OPERATOR_API_SECRET header; dry
// run by default (returns the plan, moves nothing); mainnet needs an explicit
// allowMainnet in the body on top of the secret; the signer must be the vault's
// configured operator. Meant for an internal cron / the worker, not end users.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createPublicClient, createWalletClient, http, encodeFunctionData, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chainByKey } from "@pesarc/sdk/chain/registry";
import { corridorVaultFor } from "@pesarc/sdk/chain/vault-write";
import { deployableHeadroom, targetsFor, planAllocations } from "@pesarc/sdk/liquidity/allocation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  chainKey: z.string().min(1).max(40),
  execute: z.boolean().optional(),
  allowMainnet: z.boolean().optional(),
});

const vaultAbi = [
  { type: "function", name: "idle", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalAssets", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "maxDeployBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "operator", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "strategies", stateMutability: "view", inputs: [{ name: "i", type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "allocate", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "a", type: "uint256" }], outputs: [] },
] as const;

export async function POST(request: Request) {
  const secret = process.env.OPERATOR_API_SECRET;
  if (!secret || request.headers.get("x-operator-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "chainKey required." }, { status: 400 });
  const { chainKey, execute, allowMainnet } = parsed.data;

  const cfg = chainByKey(chainKey);
  if (!cfg) return NextResponse.json({ ok: false, error: "Unknown chain." }, { status: 400 });
  const vault = corridorVaultFor(chainKey);
  if (!vault) return NextResponse.json({ ok: false, error: "No vault for this chain." }, { status: 400 });

  const pub = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpcUrl) });
  const read = (fn: string, args: readonly unknown[] = []) =>
    pub.readContract({ address: vault, abi: vaultAbi, functionName: fn as never, args: args as never });

  const [idle, total, bps, dec, operator] = (await Promise.all([
    read("idle"), read("totalAssets"), read("maxDeployBps"), read("decimals"), read("operator"),
  ]).catch(() => [])) as [bigint, bigint, bigint, number, `0x${string}`];
  if (idle === undefined) return NextResponse.json({ ok: false, error: "Could not read the vault." }, { status: 502 });
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

  if (!execute) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      vault,
      chainKey,
      tvl: fmt(total),
      idle: fmt(idle),
      headroom: fmt(headroom),
      operator,
      plan: planOut,
    });
  }

  // --- execution (moves pooled funds) ---
  if (!cfg.testnet && !allowMainnet) {
    return NextResponse.json({ ok: false, error: "Mainnet execution needs allowMainnet:true." }, { status: 400 });
  }
  if (!plan.length) return NextResponse.json({ ok: true, executed: [], note: "Nothing to allocate." });
  const pk = process.env.SETTLE_OPERATOR_PK;
  if (!pk) return NextResponse.json({ ok: false, error: "Operator key not configured." }, { status: 500 });
  const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`);
  if (account.address.toLowerCase() !== operator.toLowerCase()) {
    return NextResponse.json({ ok: false, error: "Configured key is not the vault operator." }, { status: 500 });
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
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Allocation failed.", executed },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, executed });
}
