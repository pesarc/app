// Live hub-pool TVL, read on-chain (no wallet needed). Uniswap v4 is a
// singleton: the PoolManager custodies every pool's tokens, so on a hub with a
// single USD<->NGN pool its token balances are that corridor's reserves. TVL in
// USD = usdReserve + ngnReserve / oracleMid. Safe in client or server.

import { formatUnits } from "viem";
import { getPublicClient, chainLabel } from "./chains";
import { CONTRACTS, CONTRACTS_READY } from "./contracts";
import { oracleAdapterAbi } from "@pesarc/abi";

const balanceOfAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

function poolKey() {
  return {
    currency0: CONTRACTS.tokenUsd as `0x${string}`,
    currency1: CONTRACTS.tokenNgn as `0x${string}`,
    fee: CONTRACTS.fee,
    tickSpacing: CONTRACTS.tickSpacing,
    hooks: (CONTRACTS.hook ||
      "0x0000000000000000000000000000000000000000") as `0x${string}`,
  };
}

export type LiveCorridorTvl = {
  tvlUsd: number;
  usdReserve: number;
  ngnReserve: number;
  /** Oracle mid (NGN per USD). */
  midRate: number;
  route: string;
};

/** True when the on-chain TVL read is possible on the configured hub. */
export function liveTvlAvailable(): boolean {
  return Boolean(
    CONTRACTS_READY &&
      CONTRACTS.poolManager &&
      CONTRACTS.oracleAdapter &&
      CONTRACTS.tokenUsd &&
      CONTRACTS.tokenNgn,
  );
}

/** Read the live USD<->NGN hub corridor TVL. Null when unavailable/reads fail. */
export async function fetchLiveCorridorTvl(): Promise<LiveCorridorTvl | null> {
  if (!liveTvlAvailable()) return null;
  try {
    const client = getPublicClient();
    const pm = CONTRACTS.poolManager as `0x${string}`;
    const [usdWei, ngnWei, mid1e18] = await Promise.all([
      client.readContract({
        address: CONTRACTS.tokenUsd as `0x${string}`,
        abi: balanceOfAbi,
        functionName: "balanceOf",
        args: [pm],
      }) as Promise<bigint>,
      client.readContract({
        address: CONTRACTS.tokenNgn as `0x${string}`,
        abi: balanceOfAbi,
        functionName: "balanceOf",
        args: [pm],
      }) as Promise<bigint>,
      client.readContract({
        address: CONTRACTS.oracleAdapter as `0x${string}`,
        abi: oracleAdapterAbi,
        functionName: "getPrice1e18Strict",
        args: [poolKey()],
      }) as Promise<bigint>,
    ]);
    const usdReserve = Number(formatUnits(usdWei, 18));
    const ngnReserve = Number(formatUnits(ngnWei, 18));
    const midRate = Number(formatUnits(mid1e18, 18));
    if (midRate <= 0) return null;
    return {
      tvlUsd: usdReserve + ngnReserve / midRate,
      usdReserve,
      ngnReserve,
      midRate,
      route: `Hub pool · ${chainLabel()}`,
    };
  } catch {
    return null;
  }
}
