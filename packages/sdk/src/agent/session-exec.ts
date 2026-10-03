// Agent autonomous cross-chain, via the user's session key. When the feature is
// enabled (testnet + flag) and the user has granted a scoped session key on their
// active chain, the agent SIGNS and sends a gasless CCTP USDC move itself —
// approve + depositForBurn, to the user's own address on the destination — instead
// of handing off to the screen. Returns null whenever it can't or shouldn't
// auto-execute (no mapping, no amount, no/insufficient grant), so the caller falls
// back to the pre-filled hand-off. Never touches mainnet: the guards are all in
// permissions.ts / execute.ts.

import { encodeFunctionData, parseUnits } from "viem";
import { cctpChains, tokenMessengerV2 } from "../chain/cctp/network";
import { toBytes32, FINALITY } from "../chain/cctp/bridge";
import { tokenMessengerV2Abi, erc20ApproveAbi } from "../chain/cctp/abi";
import { sessionKeysAllowed, cctpKeyFor } from "../wallet/session-keys/permissions";
import { executeWithSession } from "../wallet/session-keys/execute";
import type { SwapIntent } from "./swap-intent";

const ZERO32 = ("0x" + "0".repeat(64)) as `0x${string}`;

// Friendly chain label (from the swap intent) -> CCTP network key, for the dest.
const LABEL_TO_CCTP: Record<string, string> = {
  Arc: "arc",
  Base: "base",
  Arbitrum: "arbitrum",
  Polygon: "polygon",
  Optimism: "optimism",
  Avalanche: "avalanche",
  Ethereum: "ethereum",
};

// Structurally matches AgentReceipt in run.ts (kept local to avoid an import
// cycle: run.ts imports this module).
type Receipt = {
  kind: "transfer";
  title: string;
  status: "settled";
  lines: { label: string; value: string }[];
  txHash?: string;
};

export type AgentCrossChainResult = { reply: string; understood: string; receipt: Receipt };

const fmtAmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

/**
 * Try to execute the cross-chain move with the user's session key. Source = the
 * user's active chain; destination = the chain named in the request. Null means
 * "not auto-executed" (the caller should hand off).
 */
export async function tryAgentCrossChain(
  account: `0x${string}` | undefined,
  activeChainKey: string | undefined,
  swap: SwapIntent,
): Promise<AgentCrossChainResult | null> {
  if (!account || !activeChainKey || !sessionKeysAllowed(activeChainKey)) return null;
  if (!swap.amount || swap.amount <= 0) return null;
  if (swap.token !== "USDC") return null; // only USDC rides CCTP here

  const srcKey = cctpKeyFor(activeChainKey);
  const dstKey = LABEL_TO_CCTP[swap.to];
  if (!srcKey || !dstKey || srcKey === dstKey) return null;

  const chains = cctpChains("testnet");
  const src = chains[srcKey];
  const dst = chains[dstKey];
  if (!src || !dst || src.kind !== "evm") return null;

  const amountWei = parseUnits(String(swap.amount), 6);
  const recipient32 = toBytes32(account);
  const calls = [
    {
      to: src.usdc as `0x${string}`,
      data: encodeFunctionData({
        abi: erc20ApproveAbi,
        functionName: "approve",
        args: [tokenMessengerV2("testnet"), amountWei],
      }),
    },
    {
      to: tokenMessengerV2("testnet"),
      data: encodeFunctionData({
        abi: tokenMessengerV2Abi,
        functionName: "depositForBurn",
        // Standard finality (free); send to self on the destination.
        args: [amountWei, dst.domain, recipient32, src.usdc as `0x${string}`, ZERO32, 0n, FINALITY.standard],
      }),
    },
  ];

  const res = await executeWithSession({ account, chainKey: activeChainKey, calls, spendWei: amountWei });
  if (!res.ok) return null; // fall back to the hand-off

  const reply = [
    `Done. I moved **${fmtAmt(swap.amount)} USDC** to **${swap.to}** with your session key.`,
    "",
    "No pop-up, gas on us. I signed it on your behalf, within the limits you set.",
    res.txHash ? `\nTransaction: \`${res.txHash}\`` : "",
  ].join("\n");
  return {
    reply,
    understood: `Move ${swap.token} to ${swap.to}`,
    receipt: {
      kind: "transfer",
      title: `Cross-chain USDC to ${swap.to}`,
      status: "settled",
      lines: [
        { label: "Amount", value: `${fmtAmt(swap.amount)} USDC` },
        { label: "Destination", value: swap.to },
        { label: "Signed by", value: "Your session key" },
      ],
      txHash: res.txHash,
    },
  };
}
