"use client";

// Live on-chain balance for the connected smart wallet, read on the ACTIVE chain
// (not the hub). Given a currency code it resolves that token's address on the
// chain the user is currently on and reads balanceOf for the smart account, so
// switching network (testnet <-> mainnet, Arc <-> Base …) shows the right balance.
// Falls back gracefully (available:false) when there's no wallet/token yet.

import { useEffect, useState } from "react";
import { erc20Abi } from "@pesarc/abi";
import { useSmartWallet } from "../wallet/smartWallet";
import { useActiveEvmChain } from "./activeChain";
import { tokenByCode } from "./evm-settle";
import { publicClientFor } from "./registry";

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

export function useLiveBalance(code: string = "USD"): LiveBalance {
  const smart = useSmartWallet();
  const { chain } = useActiveEvmChain();
  // Resolve by SYMBOL via tokenByCode, not just chain.tokens[currency]. USDT and
  // PYUSD both map to currency "USD" and would otherwise read the USDC balance;
  // tokenByCode resolves each distinct token's real address from the registry.
  const token = tokenByCode(chain, code)?.address as `0x${string}` | undefined;
  const owner = smart.address;

  const [state, setState] = useState<{ loading: boolean; amount?: number; symbol?: string; error?: string }>({ loading: false });

  useEffect(() => {
    if (!token || !owner) {
      setState({ loading: false });
      return;
    }
    let alive = true;
    setState({ loading: true });
    const client = publicClientFor(chain);
    Promise.all([
      client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [owner] }) as Promise<bigint>,
      client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }).then(Number).catch(() => 18),
      client.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }).then(String).catch(() => code.toUpperCase()),
    ])
      .then(([bal, decimals, symbol]) => {
        if (alive) setState({ loading: false, amount: Number(bal) / 10 ** decimals, symbol });
      })
      .catch((e) => alive && setState({ loading: false, error: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
    // Re-read when the token, owner, or active chain changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, owner, chain.key]);

  const available = Boolean(token && owner);
  return {
    available,
    loading: available && state.loading,
    amount: state.amount,
    symbol: state.symbol ?? code.toUpperCase(),
    error: state.error,
    chainKey: chain.key,
    chainLabel: chain.label,
    address: owner,
  };
}
