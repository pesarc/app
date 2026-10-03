// Direct on-chain token transfer from the connected smart wallet, gasless.
//
// This is what "send to a wallet" should do: move the ACTUAL token the user
// holds on the ACTIVE chain straight to the recipient address — no corridor
// swap, no ramp escrow. The amount is the user's own balance leg (USDC/USD),
// so the recipient receives exactly what was sent, on the same chain.

import { encodeFunctionData, parseUnits, type PublicClient } from "viem";
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

/** Read a token's decimals on the ACTIVE chain (via `client`), falling back to
 *  the hub client only when no active-chain client is given. */
async function readTokenDecimals(
  token: `0x${string}`,
  client?: PublicClient,
): Promise<number> {
  if (!client) return readDecimals(token);
  try {
    const d = await client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" });
    return Number(d);
  } catch {
    // Last resort: the active-chain read failed; try the hub before defaulting.
    return readDecimals(token);
  }
}

/**
 * Transfers `amount` of `token` from the smart wallet to `to` on the active
 * chain. Throws on failure (no silent success) so the UI can surface it.
 *
 * `client` MUST be a public client for the ACTIVE chain — decimals are read from
 * it so the amount is scaled correctly. Without it we fall back to the hub
 * client, which is WRONG for a token that only exists off-hub (e.g. Arc's native
 * USDC predeploy is 6-dec on Arc but absent on the hub, where the read reverts
 * and defaults to 18 — turning "1 USDC" into 1e12 and reverting the transfer).
 */
export async function sendTokenDirect(
  smart: SmartWalletLike,
  token: `0x${string}`,
  to: `0x${string}`,
  amount: number,
  client?: PublicClient
): Promise<DirectSendResult> {
  if (!token) throw new Error("No token is configured on this chain.");
  if (!to) throw new Error("Missing recipient address.");
  if (!(amount > 0)) throw new Error("Enter an amount to send.");

  const decimals = await readTokenDecimals(token, client);
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
