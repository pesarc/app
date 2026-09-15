// Shared testnet corridor-send execution: gasless approve + USD→NGN swap on
// the hub pool, then an optional payout transfer of the received cNGN to the
// recipient's address. Used by the Send flow and the Scan & Pay flow.

import { encodeFunctionData, formatUnits, parseUnits } from "viem";
import { CONTRACTS } from "./contracts";
import { erc20Abi } from "@stablearc/abi";
import { swapRouterAbi, MIN_SQRT_PRICE_LIMIT } from "@stablearc/abi";
import { readBalance, readDecimals } from "./erc20Read";

export type CorridorSendResult = {
  /** Swap (settlement) tx/userop hash. */
  tx?: string;
  /** cNGN actually received, measured as the on-chain balance delta. */
  received?: number;
  /** Payout transfer hash, when the cNGN was forwarded to a recipient. */
  payoutTx?: string;
};

type SmartWalletLike = {
  address?: string;
  sendCalls: (
    calls: { to: `0x${string}`; data: `0x${string}`; value?: bigint }[]
  ) => Promise<string | undefined>;
};

/**
 * Executes the real corridor send from the connected smart wallet.
 * `payoutTo` (optional) receives the swapped cNGN; self-sends skip payout.
 */
export async function executeCorridorSend(
  smart: SmartWalletLike,
  amountUsd: number,
  payoutTo?: `0x${string}` | ""
): Promise<CorridorSendResult> {
  const tokenUsd = CONTRACTS.tokenUsd as `0x${string}`;
  const tokenNgn = CONTRACTS.tokenNgn as `0x${string}`;
  const router = CONTRACTS.swapRouter as `0x${string}`;
  const owner = smart.address as `0x${string}` | undefined;
  const hook = (CONTRACTS.hook ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`;
  if (!tokenUsd || !tokenNgn || !router) throw new Error("Pool not configured");

  const usdDecimals = await readDecimals(tokenUsd);
  const amountWei = parseUnits(
    amountUsd.toFixed(Math.min(usdDecimals, 6)),
    usdDecimals
  );

  // Snapshot NGN balance before the swap to measure the real output.
  const ngnDecimals = await readDecimals(tokenNgn);
  const before = owner ? await readBalance(tokenNgn, owner).catch(() => 0n) : 0n;

  const approveData = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [router, amountWei],
  });
  const swapData = encodeFunctionData({
    abi: swapRouterAbi,
    functionName: "swap",
    args: [
      {
        currency0: tokenUsd,
        currency1: tokenNgn,
        fee: CONTRACTS.fee,
        tickSpacing: CONTRACTS.tickSpacing,
        hooks: hook,
      },
      {
        zeroForOne: true, // USD (token0) -> NGN (token1)
        amountSpecified: -amountWei, // exact input
        sqrtPriceLimitX96: MIN_SQRT_PRICE_LIMIT,
      },
    ],
  });

  const tx = await smart.sendCalls([
    { to: tokenUsd, data: approveData },
    { to: router, data: swapData },
  ]);

  let received: number | undefined;
  let deltaWei = 0n;
  try {
    if (owner) {
      const after = await readBalance(tokenNgn, owner);
      deltaWei = after - before;
      if (deltaWei > 0n) received = Number(formatUnits(deltaWei, ngnDecimals));
    }
  } catch {
    /* output amount is best-effort */
  }

  // Payout leg: deliver the received cNGN to the recipient's address.
  let payoutTx: string | undefined;
  if (
    deltaWei > 0n &&
    payoutTo &&
    owner &&
    payoutTo.toLowerCase() !== owner.toLowerCase()
  ) {
    try {
      payoutTx = await smart.sendCalls([
        {
          to: tokenNgn,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [payoutTo, deltaWei],
          }),
        },
      ]);
    } catch {
      /* payout is best-effort — the funds stay in the sender's wallet */
    }
  }

  return { tx, received, payoutTx };
}
