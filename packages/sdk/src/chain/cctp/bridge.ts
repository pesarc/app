// Client-side helpers for the production CCTP V2 bridge (non-custodial).
// The flow: approve USDC -> depositForBurn on the source (user's wallet) ->
// Circle attests -> relayer mints on the destination (see /api/bridge/relay).
import { defineChain, pad, type Chain } from "viem";
import { CCTP_MAINNET, type CctpMainnetChain } from "./mainnet";

// minFinalityThreshold selects the transfer speed. Standard is free and settles
// at hard finality (~13-19 min on most chains); Fast pays a small maxFee and
// lands in seconds. Phase 1 ships Standard (free); Fast is a maxFee param away.
export const FINALITY = { standard: 2000, fast: 1000 } as const;

/** Left-pad a 20-byte EVM address into the bytes32 CCTP expects. */
export function toBytes32(address: `0x${string}`): `0x${string}` {
  return pad(address.toLowerCase() as `0x${string}`, { size: 32 });
}

/** USDC has 6 decimals on every CCTP chain. */
export const USDC_DECIMALS = 6;

export function parseUsdc(amount: string): bigint {
  const [whole, frac = ""] = amount.trim().split(".");
  const f = (frac + "000000").slice(0, USDC_DECIMALS);
  return BigInt(whole || "0") * 1_000_000n + BigInt(f || "0");
}

export function formatUsdc(v: bigint): string {
  const s = (Number(v) / 1_000_000).toFixed(2);
  return s;
}

export type BridgeQuote = {
  amountIn: bigint;
  amountOut: bigint;
  feeUsdc: bigint;
  etaLabel: string;
};

/** Standard transfer: no fee, amountOut == amountIn (settles at hard finality). */
export function quoteStandard(amountIn: bigint): BridgeQuote {
  return { amountIn, amountOut: amountIn, feeUsdc: 0n, etaLabel: "~13–19 min" };
}

/** Absolute maxFee (USDC units) for a Fast transfer, from Circle's fee in bps.
 *  Circle's fee is fractional (e.g. 0.325 bps), so work in milli-bps to keep
 *  precision — a plain ceil(bps) would turn 0.325 into 1 and overcharge 3x.
 *  maxFee is a CEILING (Circle deducts the actual, smaller fee), so we add a
 *  small margin (25%) so a fee tick between quote and burn can't strand the
 *  transfer. */
export function maxFeeFor(amountIn: bigint, bps: number): bigint {
  if (!Number.isFinite(bps) || bps <= 0) return 0n;
  const milliBps = BigInt(Math.ceil(bps * 1000 * 1.25)); // bps→milli-bps, +25%
  // ceil division by 10_000_000 (= 10_000 bps × 1_000 milli).
  return (amountIn * milliBps + 9_999_999n) / 10_000_000n;
}

/** Fast transfer: lands in seconds; Circle deducts up to maxFee from the mint. */
export function quoteFast(amountIn: bigint, bps: number): BridgeQuote {
  const fee = maxFeeFor(amountIn, bps);
  return { amountIn, amountOut: amountIn - fee, feeUsdc: fee, etaLabel: "~seconds" };
}

/** Fetch Circle's Fast-transfer fee (bps) for a domain pair via our server. */
export async function fetchFee(
  src: number,
  dst: number,
): Promise<{ fastBps: number | null; standardBps: number }> {
  try {
    const res = await fetch("/api/bridge/fee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ src, dst }),
    });
    const j = (await res.json()) as { ok: boolean; fastBps?: number | null; standardBps?: number };
    if (!j.ok) return { fastBps: null, standardBps: 0 };
    return { fastBps: j.fastBps ?? null, standardBps: j.standardBps ?? 0 };
  } catch {
    return { fastBps: null, standardBps: 0 };
  }
}

/** A viem Chain for a CCTP EVM entry, so a walletClient can target it. */
export function viemChainFor(c: CctpMainnetChain): Chain {
  const rpc = process.env[c.rpcEnv] || defaultRpc(c.key);
  return defineChain({
    id: c.chainId as number,
    name: c.label,
    nativeCurrency:
      c.key === "arc"
        ? { name: "USD Coin", symbol: "USDC", decimals: 18 }
        : { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
    blockExplorers: { default: { name: `${c.label} Explorer`, url: explorerBase(c) } },
  });
}

function explorerBase(c: CctpMainnetChain): string {
  // Derive from the tx formatter's prefix.
  return c.explorerTx("").replace(/\/tx\/$/, "");
}

// Public RPC fallbacks when the *_RPC_URL env isn't set. Override in prod.
function defaultRpc(key: string): string {
  switch (key) {
    case "ethereum": return "https://ethereum-rpc.publicnode.com";
    case "arbitrum": return "https://arb1.arbitrum.io/rpc";
    case "base": return "https://mainnet.base.org";
    case "optimism": return "https://mainnet.optimism.io";
    case "polygon": return "https://polygon-rpc.com";
    case "avalanche": return "https://api.avax.network/ext/bc/C/rpc";
    case "arc": return "https://rpc.mainnet.arc.io";
    default: return "";
  }
}

/** EVM CCTP chains only (Phase 1 flow — Solana lands next). */
export function evmBridgeChains(): CctpMainnetChain[] {
  return Object.values(CCTP_MAINNET).filter((c) => c.kind === "evm");
}

export type RelayResult =
  | { ok: true; mintTx: `0x${string}`; explorer: string }
  | { ok: false; error: string; pending?: boolean };

/**
 * Ask the server relayer to finalize a burn: it polls Circle's attestation and
 * calls receiveMessage on the destination (gasless for the user — the relayer
 * pays destination gas, which is what lets it fund an otherwise-empty wallet,
 * e.g. a fresh Arc address).
 */
export async function relayMint(input: {
  srcDomain: number;
  burnTx: `0x${string}`;
  dstKey: string;
}): Promise<RelayResult> {
  const res = await fetch("/api/bridge/relay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return (await res.json()) as RelayResult;
}
