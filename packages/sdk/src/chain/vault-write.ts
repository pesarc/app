// CorridorVault WRITE path — the on-chain Earn deposit/withdraw, signed gaslessly
// by the smart wallet (approve + deposit in one batched userOp, the same pattern
// as a corridor send or a market stake). The vault is an ERC-4626, so deposit
// takes assets and mints shares; withdraw/redeem burn shares for assets. Reads
// (balance, preview, APY) live elsewhere; this is the transact side.

import { encodeFunctionData, parseUnits } from "viem";
import { erc20Abi } from "@pesarc/abi";
import type { BatchSender } from "../market-write";

// Minimal ERC-4626 surface we transact against.
const erc4626Abi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    type: "function",
    name: "redeem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "assets", type: "uint256" }],
  },
] as const;

export type VaultDepositParams = {
  vault: `0x${string}`;
  /** The asset the vault accepts (USDC). */
  asset: `0x${string}`;
  /** Whole asset units to deposit. */
  amount: number;
  /** Who receives the shares (defaults to the sender's address). */
  receiver?: `0x${string}`;
  /** Asset decimals (USDC = 6). */
  decimals?: number;
};

/** Approve the asset + deposit into the vault, in one gasless batch. */
export async function evmVaultDeposit(sender: BatchSender, p: VaultDepositParams): Promise<string | undefined> {
  const receiver = (p.receiver ?? (sender.address as `0x${string}`)) as `0x${string}`;
  const amountWei = parseUnits(String(p.amount), p.decimals ?? 6);
  const approve = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [p.vault, amountWei] });
  const deposit = encodeFunctionData({ abi: erc4626Abi, functionName: "deposit", args: [amountWei, receiver] });
  return sender.sendCalls([
    { to: p.asset, data: approve },
    { to: p.vault, data: deposit },
  ]);
}

export type VaultWithdrawParams = {
  vault: `0x${string}`;
  /** Whole asset units to withdraw (drawn from idle liquidity). */
  amount: number;
  receiver?: `0x${string}`;
  decimals?: number;
};

/** Withdraw assets from the vault (burns the owner's shares). Gasless. */
export async function evmVaultWithdraw(sender: BatchSender, p: VaultWithdrawParams): Promise<string | undefined> {
  const who = (p.receiver ?? (sender.address as `0x${string}`)) as `0x${string}`;
  const amountWei = parseUnits(String(p.amount), p.decimals ?? 6);
  const data = encodeFunctionData({ abi: erc4626Abi, functionName: "withdraw", args: [amountWei, who, who] });
  return sender.sendCalls([{ to: p.vault, data }]);
}

/** Redeem all (or `shares`) vault shares back to assets. Gasless. */
export async function evmVaultRedeem(
  sender: BatchSender,
  p: { vault: `0x${string}`; shares: bigint; receiver?: `0x${string}` },
): Promise<string | undefined> {
  const who = (p.receiver ?? (sender.address as `0x${string}`)) as `0x${string}`;
  const data = encodeFunctionData({ abi: erc4626Abi, functionName: "redeem", args: [p.shares, who, who] });
  return sender.sendCalls([{ to: p.vault, data }]);
}

/** Can we do a real on-chain vault deposit right now? */
export function evmVaultReady(sender: BatchSender | null | undefined, vault?: string): boolean {
  return Boolean(sender?.ready && sender.address && vault && /^0x[0-9a-fA-F]{40}$/.test(vault));
}

// The deployed CorridorVault per chain. Literal NEXT_PUBLIC refs so Next inlines
// them into the client bundle (a dynamic process.env[key] would not inline).
const VAULTS: Record<string, string | undefined> = {
  arc: process.env.NEXT_PUBLIC_ARC_CORRIDOR_VAULT,
  "arc-testnet": process.env.NEXT_PUBLIC_ARC_TESTNET_CORRIDOR_VAULT,
  base: process.env.NEXT_PUBLIC_BASE_CORRIDOR_VAULT,
  "base-sepolia": process.env.NEXT_PUBLIC_BASE_SEPOLIA_CORRIDOR_VAULT,
  arbitrum: process.env.NEXT_PUBLIC_ARBITRUM_CORRIDOR_VAULT,
  "arbitrum-sepolia": process.env.NEXT_PUBLIC_ARB_SEPOLIA_CORRIDOR_VAULT,
};

/** The CorridorVault address configured for a chain, if any. */
export function corridorVaultFor(chainKey?: string): `0x${string}` | undefined {
  const v = chainKey ? VAULTS[chainKey] : undefined;
  return v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as `0x${string}`) : undefined;
}
