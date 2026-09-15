// Venue-neutral prediction-market WRITE path (stake). Reads live in
// markets.venue; this is the transact side. EVM is real and gasless via the
// smart wallet (approve + stake in one batched userOp, the same pattern as
// corridor sends). SVM lives in svm/write.ts and is loaded lazily.

import { encodeFunctionData, parseUnits } from "viem";
import { predictionMarketAbi, erc20Abi } from "@pesarc/abi";

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

/** Approve collateral + stake, in one gasless batch. Returns the tx hash. */
export async function evmStake(
  sender: BatchSender,
  p: EvmStakeParams,
): Promise<string | undefined> {
  const amountWei = parseUnits(String(p.amount), p.decimals ?? 18);
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
