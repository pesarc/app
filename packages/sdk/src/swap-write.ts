// Real cross-currency swap from the USER's own smart wallet: approve the
// IntentMatcher + submitIntent in one gasless batched userOp (same pattern as
// market-write's evmStake). The user's funds move; the solver then matches the
// intent against opposing flow to settle it peer-to-peer. Demo callers (no wallet)
// keep the simulated path in the UI.

import { encodeFunctionData, parseUnits, stringToHex, type PublicClient } from "viem";
import { intentMatcherAbi, erc20Abi } from "@pesarc/abi";
import type { BatchSender } from "./market-write";

/** Read a token's decimals on the ACTIVE chain (via `client`). Defaults to 18
 *  only when no client is given or the read fails — hardcoding 18 mis-scales
 *  6-dec tokens like USDC (turns a swap of 10 into 1e13 and reverts). */
async function tokenDecimals(
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

/** Approve + submit a swap intent in one batch. Returns the tx hash. `client` is
 *  a public client for the ACTIVE chain, used to read each token's real decimals
 *  (tokenIn and tokenOut can differ, e.g. USDC 6 -> cNGN 18). */
export async function evmSwap(
  sender: BatchSender,
  p: EvmSwapParams,
  client?: PublicClient,
): Promise<string | undefined> {
  const inDec = p.decimals ?? (await tokenDecimals(p.tokenIn, client));
  const outDec = await tokenDecimals(p.tokenOut, client, p.decimals ?? 18);
  const amountInWei = parseUnits(p.amountIn.toFixed(Math.min(inDec, 6)), inDec);
  const minOutWei = parseUnits(Math.max(0, p.minAmountOut).toFixed(Math.min(outDec, 6)), outDec);
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
