// Direct on-chain token transfer from the connected smart wallet, gasless.
//
// This is what "send to a wallet" should do: move the ACTUAL token the user
// holds on the ACTIVE chain straight to the recipient address — no corridor
// swap, no ramp escrow. The amount is the user's own balance leg (USDC/USD),
// so the recipient receives exactly what was sent, on the same chain.

import { encodeFunctionData, parseUnits } from "viem";
import { erc20Abi } from "@pesarc/abi";
import { readDecimals } from "./erc20Read";

export type DirectSendResult = {
  /** Transfer tx/userop hash. */
  tx?: string;
  /** Amount delivered to the recipient (same token the user holds). */
  received?: number;
};

type SmartWalletLike = {
  address?: string;
  sendCalls: (
    calls: { to: `0x${string}`; data: `0x${string}`; value?: bigint }[]
  ) => Promise<string | undefined>;
};

/**
 * Transfers `amount` of `token` from the smart wallet to `to` on the active
 * chain. Throws on failure (no silent success) so the UI can surface it.
 */
export async function sendTokenDirect(
  smart: SmartWalletLike,
  token: `0x${string}`,
  to: `0x${string}`,
  amount: number
): Promise<DirectSendResult> {
  if (!token) throw new Error("No token is configured on this chain.");
  if (!to) throw new Error("Missing recipient address.");
  if (!(amount > 0)) throw new Error("Enter an amount to send.");

  const decimals = await readDecimals(token);
  const amountWei = parseUnits(amount.toFixed(Math.min(decimals, 6)), decimals);

  const tx = await smart.sendCalls([
    {
      to: token,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [to, amountWei],
      }),
    },
  ]);
  if (!tx) throw new Error("The transfer didn't go through.");
  return { tx, received: amount };
}
