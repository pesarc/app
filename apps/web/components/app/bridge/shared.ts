"use client";

// Shared bridge helpers used by both the CCTP USDC card and the Hyperbridge
// panel. Kept in one module so the two surfaces read balances and map chain ids
// the same way.
import { useEffect, useState } from "react";
import { createPublicClient, http } from "viem";

// Hyperbridge chain id -> registry chain key, so picking a "From" can set the
// active network — the embedded smart wallet signs on whichever chain is active.
export const HYPER_CHAIN_KEY: Record<number, string> = {
  84532: "base-sepolia",
  421614: "arbitrum-sepolia",
  11155111: "sepolia",
  11155420: "optimism-sepolia",
  80002: "polygon-amoy",
  8453: "base",
  42161: "arbitrum",
  10: "optimism",
  137: "polygon",
  1: "ethereum",
};

const BAL_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;

/** The smart wallet's balance of `token` on an arbitrary chain (not necessarily
 *  the active one), so cross-chain shows how much you actually hold on the FROM
 *  chain. Works for testnet and mainnet — it reads that chain's own RPC. */
export function useTokenBalanceOn(
  token: `0x${string}` | undefined,
  viemChain: { rpcUrls: { default: { http: readonly string[] } } } | undefined,
  rpcUrl: string | undefined,
  owner?: string,
): { amount?: number; loading: boolean } {
  const [state, setState] = useState<{ amount?: number; loading: boolean }>({ loading: false });
  useEffect(() => {
    if (!token || !owner || !viemChain || !rpcUrl) {
      setState({ loading: false });
      return;
    }
    let alive = true;
    setState({ loading: true });
    const pub = createPublicClient({ chain: viemChain as never, transport: http(rpcUrl) });
    Promise.all([
      pub.readContract({ address: token, abi: BAL_ABI, functionName: "balanceOf", args: [owner as `0x${string}`] }),
      pub.readContract({ address: token, abi: BAL_ABI, functionName: "decimals" }).catch(() => 6),
    ])
      .then(([b, d]) => alive && setState({ amount: Number(b) / 10 ** Number(d), loading: false }))
      .catch(() => alive && setState({ loading: false }));
    return () => {
      alive = false;
    };
    // rpcUrl identifies the chain; re-read only when token/owner/chain change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, owner, rpcUrl]);
  return state;
}
