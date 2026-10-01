// CorridorVault READ path — what the Earn UI needs to show the REAL on-chain
// vault instead of an illustrative label: the pool's total assets (TVL), the
// user's own position (their shares valued in assets), and the current share
// price. No wallet needed; this reads the chain. The write side lives in
// vault-write.ts.
//
// APY is deliberately NOT derived here: an honest APY needs share-price history,
// which a single read can't give. The UI shows the real balance and TVL and
// keeps any headline rate labelled indicative rather than inventing one.

import { formatUnits } from "viem";
import type { EvmChainConfig } from "./registry";
import { publicClientFor } from "./registry";

// The ERC-4626 views we read. `convertToAssets` prices shares at the current
// exchange rate, so the user's position reflects accrued yield.
const erc4626ReadAbi = [
  { type: "function", name: "totalAssets", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "a", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "convertToAssets",
    stateMutability: "view",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export type VaultSnapshot = {
  /** Total assets under management in the vault, in whole asset units. */
  tvl: number;
  /** The owner's position valued in assets (0 when no owner / no shares). */
  position: number;
  /** The owner's raw share balance (for a full redeem). */
  shares: bigint;
};

/**
 * Read a CorridorVault's TVL and, when an owner is given, that owner's position.
 * Returns null on any read failure so callers fall back to indicative figures
 * rather than showing a wrong number.
 */
export async function fetchVaultSnapshot(
  chainCfg: EvmChainConfig,
  vault: `0x${string}`,
  owner?: `0x${string}`,
): Promise<VaultSnapshot | null> {
  try {
    const client = publicClientFor(chainCfg);
    const read = (functionName: string, args: readonly unknown[] = []) =>
      client.readContract({ address: vault, abi: erc4626ReadAbi, functionName: functionName as never, args: args as never });

    const [totalWei, dec] = (await Promise.all([
      read("totalAssets"),
      read("decimals").catch(() => 6),
    ])) as [bigint, number];
    const decimals = Number(dec);

    let shares = 0n;
    let position = 0;
    if (owner) {
      shares = (await read("balanceOf", [owner])) as bigint;
      if (shares > 0n) {
        const assetsWei = (await read("convertToAssets", [shares])) as bigint;
        position = Number(formatUnits(assetsWei, decimals));
      }
    }
    return { tvl: Number(formatUnits(totalWei, decimals)), position, shares };
  } catch {
    return null;
  }
}
