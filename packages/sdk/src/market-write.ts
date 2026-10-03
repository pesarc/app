// Venue-neutral prediction-market WRITE path (stake). Reads live in
// markets.venue; this is the transact side. EVM is real and gasless via the
// smart wallet (approve + stake in one batched userOp, the same pattern as
// corridor sends). SVM lives in svm/write.ts and is loaded lazily.

import { encodeFunctionData, parseUnits, type PublicClient } from "viem";
import { predictionMarketAbi, erc20Abi } from "@pesarc/abi";

/** Read the collateral token's decimals on the ACTIVE chain. Hardcoding 18 is
 *  wrong for 6-dec collateral like Arc's native USDC (turns a 20 stake into
 *  2e19 and reverts). Falls back to `fallback` only if no client / the read fails. */
async function collateralDecimals(
  token: `0x${string}`,
  client?: PublicClient,
  fallback = 18,
): Promise<number> {
  if (!client) return fallback;
  try {
    return Number(await client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }));
  } catch {
    return fallback;
  }
}

/** Minimal shape of the app's smart wallet (see wallet/smart-wallet). */
export type BatchSender = {
  ready: boolean;
  address?: string;
  sendCalls: (calls: { to: `0x${string}`; data: `0x${string}`; value?: bigint }[]) => Promise<string | undefined>;
};

export type EvmStakeParams = {
  predictionMarket: `0x${string}`;
  collateralToken: `0x${string}`;
  marketId: number;
  isYes: boolean;
  /** whole collateral units */
  amount: number;
  decimals?: number;
};

/** Approve collateral + stake, in one batch. Returns the tx hash. `client` is a
 *  public client for the ACTIVE chain, used to read the collateral's decimals
 *  when `p.decimals` isn't given. */
export async function evmStake(
  sender: BatchSender,
  p: EvmStakeParams,
  client?: PublicClient,
): Promise<string | undefined> {
  const decimals = p.decimals ?? (await collateralDecimals(p.collateralToken, client));
  const amountWei = parseUnits(String(p.amount), decimals);
  const approveData = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [p.predictionMarket, amountWei],
  });
  const stakeData = encodeFunctionData({
    abi: predictionMarketAbi,
    functionName: "stake",
    args: [BigInt(p.marketId), p.isYes, amountWei],
  });
  return sender.sendCalls([
    { to: p.collateralToken, data: approveData },
    { to: p.predictionMarket, data: stakeData },
  ]);
}

/** Claim winnings on a finalized EVM market (gasless via the smart wallet). */
export async function evmClaim(
  sender: BatchSender,
  p: { predictionMarket: `0x${string}`; marketId: number },
): Promise<string | undefined> {
  const data = encodeFunctionData({
    abi: predictionMarketAbi,
    functionName: "claim",
    args: [BigInt(p.marketId)],
  });
  return sender.sendCalls([{ to: p.predictionMarket, data }]);
}

/** Can we do a real EVM stake right now? */
export function evmStakeReady(
  sender: BatchSender | null | undefined,
  predictionMarket?: string,
  collateralToken?: string,
): boolean {
  return Boolean(sender?.ready && predictionMarket && collateralToken);
}
