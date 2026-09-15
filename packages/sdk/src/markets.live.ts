// Live read of the on-chain PredictionMarket (Celo Sepolia). Overlays real
// pools + implied odds onto the market catalog. Fails soft: any RPC/decoding
// error returns null and the UI stays on the mock catalog (house live-vs-mock
// rule — the screen never hard-fails).

import { formatUnits } from "viem";
import { celoPublicClient, CELO } from "@pesarc/sdk/celo/config";
import { predictionMarketAbi } from "@pesarc/abi";

export type LiveMarket = {
  id: number;
  poolYes: number; // whole collateral units
  poolNo: number;
  impliedYes: number; // 0..1
  outcome: number; // 0 Unresolved · 1 Yes · 2 No · 3 Invalid
  status: number; // 0 Trading · 1 Proposed · 2 Disputed · 3 Finalized
};

const COLLATERAL_DECIMALS = 18; // test stables are 18-dec

export async function fetchLiveMarkets(): Promise<LiveMarket[] | null> {
  const address = CELO.predictionMarket;
  if (!address) return null;

  try {
    const client = celoPublicClient();
    const count = Number(
      await client.readContract({
        address,
        abi: predictionMarketAbi,
        functionName: "marketCount",
      })
    );
    if (!count) return [];

    const ids = Array.from({ length: count }, (_, i) => i);
    const out = await Promise.all(
      ids.map(async (id): Promise<LiveMarket> => {
        const [m, implied] = await Promise.all([
          client.readContract({
            address,
            abi: predictionMarketAbi,
            functionName: "getMarket",
            args: [BigInt(id)],
          }),
          client.readContract({
            address,
            abi: predictionMarketAbi,
            functionName: "impliedYes1e18",
            args: [BigInt(id)],
          }),
        ]);
        return {
          id,
          poolYes: Number(formatUnits(m.poolYes, COLLATERAL_DECIMALS)),
          poolNo: Number(formatUnits(m.poolNo, COLLATERAL_DECIMALS)),
          impliedYes: Number(formatUnits(implied, 18)),
          outcome: m.outcome,
          status: m.status,
        };
      })
    );
    return out;
  } catch {
    return null;
  }
}
