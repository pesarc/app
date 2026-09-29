// Real cross-currency swap from the USER's own smart wallet: approve the
// IntentMatcher + submitIntent in one gasless batched userOp (same pattern as
// market-write's evmStake). The user's funds move; the solver then matches the
// intent against opposing flow to settle it peer-to-peer. Demo callers (no wallet)
// keep the simulated path in the UI.

import { encodeFunctionData, parseUnits, stringToHex } from "viem";
import { intentMatcherAbi, erc20Abi } from "@pesarc/abi";
import type { BatchSender } from "./market-write";

export type EvmSwapParams = {
  intentMatcher: `0x${string}`;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  /** whole token units */
  amountIn: number;
  minAmountOut: number;
  recipient: `0x${string}`;
  ref: string;
  decimals?: number;
};

/** Approve + submit a swap intent in one gasless batch. Returns the tx hash. */
export async function evmSwap(
  sender: BatchSender,
  p: EvmSwapParams,
): Promise<string | undefined> {
  const dec = p.decimals ?? 18;
  const amountInWei = parseUnits(p.amountIn.toFixed(6), dec);
  const minOutWei = parseUnits(Math.max(0, p.minAmountOut).toFixed(6), dec);
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 24 * 3600);
  // 32-byte ref, browser-safe (no Buffer): right-pads the string to bytes32.
  const refBytes = stringToHex(p.ref.slice(0, 32), { size: 32 });

  const approveData = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [p.intentMatcher, amountInWei],
  });
  const submitData = encodeFunctionData({
    abi: intentMatcherAbi,
    functionName: "submitIntent",
    args: [p.tokenIn, p.tokenOut, amountInWei, minOutWei, p.recipient, expiry, refBytes],
  });
  return sender.sendCalls([
    { to: p.tokenIn, data: approveData },
    { to: p.intentMatcher, data: submitData },
  ]);
}
