// Treasury reads for the admin dashboard: the USDC held in the ramp escrow (the
// crypto that backs fiat payouts) across every configured chain. Read-only and
// best-effort per chain — one unreachable RPC never fails the whole snapshot.

import { erc20Abi } from "@pesarc/abi";
import { configuredChains, publicClientFor } from "./chain/registry";
import { realStablecoinsForAppChain } from "./chain/stablecoin-registry";

export type EscrowChainBalance = {
  chainKey: string;
  label: string;
  testnet: boolean;
  usdc: number;
};

/** USDC sitting in the ramp escrow on each configured chain. The escrow is where
 *  a user's USDC lands on cash-out; the fiat partner then pays out against it. */
export async function escrowUsdcBalances(): Promise<EscrowChainBalance[]> {
  const escrow = process.env.NEXT_PUBLIC_RAMP_ESCROW;
  if (!escrow || !/^0x[0-9a-fA-F]{40}$/.test(escrow)) return [];
  const addr = escrow as `0x${string}`;

  const results = await Promise.all(
    configuredChains().map(async (c): Promise<EscrowChainBalance | null> => {
      const usdc = realStablecoinsForAppChain(c.key, c.testnet).find((s) => s.symbol === "USDC");
      if (!usdc) return null;
      try {
        const bal = (await publicClientFor(c).readContract({
          address: usdc.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [addr],
        })) as bigint;
        return { chainKey: c.key, label: c.label, testnet: c.testnet, usdc: Number(bal) / 1e6 };
      } catch {
        return null; // RPC down / token absent — skip this chain
      }
    }),
  );
  return results.filter((r): r is EscrowChainBalance => r !== null);
}
