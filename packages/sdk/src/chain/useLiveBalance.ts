"use client";

// Live on-chain balance for the connected smart wallet on the ACTIVE chain,
// denominated in the settlement stablecoin (USDC). Falls back gracefully
// (available:false) when there's no wallet/token yet, so callers can show a
// demo balance instead.
import { useSmartWallet } from "../wallet/smartWallet";
import { useActiveEvmChain } from "./activeChain";
import { useErc20Balance } from "./useErc20Balance";

export type LiveBalance = {
  /** True when a real wallet + token are wired for the active chain. */
  available: boolean;
  loading: boolean;
  /** Human amount (balance / 10^decimals), or undefined until loaded. */
  amount?: number;
  symbol: string;
  error?: string;
  chainKey: string;
  chainLabel: string;
  address?: `0x${string}`;
};

export function useLiveBalance(): LiveBalance {
  const smart = useSmartWallet();
  const { chain } = useActiveEvmChain();
  const token = chain.tokens.USD;
  const owner = smart.address;
  const { loading, data, error } = useErc20Balance(token, owner);

  const available = Boolean(token && owner);
  const amount = data ? Number(data.balance) / 10 ** data.decimals : undefined;

  return {
    available,
    loading: available && loading,
    amount,
    symbol: data?.symbol ?? "USDC",
    error,
    chainKey: chain.key,
    chainLabel: chain.label,
    address: owner,
  };
}
