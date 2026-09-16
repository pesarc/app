"use client";

// In-session active EVM chain. Holds the selected chain key, syncs the registry
// override synchronously (so activeChain() reads it), and persists to
// localStorage. Wrap the app above the wallet provider so the smart wallet
// re-initialises when the chain changes.

import { createContext, useContext, useMemo, useState } from "react";
import {
  setActiveChainKey,
  configuredChains,
  activeChain,
  type EvmChainConfig,
} from "./registry";

const KEY = "pesarc.evm-chain";

type Ctx = {
  chainKey: string;
  chain: EvmChainConfig;
  chains: EvmChainConfig[]; // configured EVM chains you can switch between
  setChainKey: (key: string) => void;
};

const ActiveChainContext = createContext<Ctx | null>(null);

function initialKey(): string | null {
  try {
    return typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
  } catch {
    return null;
  }
}

export function ActiveChainProvider({ children }: { children: React.ReactNode }) {
  const [chainKey, setKey] = useState<string | null>(initialKey);

  // Set the registry override synchronously on every render so any activeChain()
  // call in this tree (reads + the smart wallet) sees the selected chain.
  if (chainKey) setActiveChainKey(chainKey);

  const setChainKey = (key: string) => {
    try {
      localStorage.setItem(KEY, key);
    } catch {
      /* ignore */
    }
    setActiveChainKey(key);
    setKey(key);
  };

  const value = useMemo<Ctx>(() => {
    const chains = configuredChains().filter((c) => c.testnet || !c.testnet); // all configured
    const chain = activeChain();
    return { chainKey: chain.key, chain, chains, setChainKey };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainKey]);

  return <ActiveChainContext.Provider value={value}>{children}</ActiveChainContext.Provider>;
}

export function useActiveEvmChain(): Ctx {
  const ctx = useContext(ActiveChainContext);
  if (ctx) return ctx;
  // Fallback for trees without the provider (SSR / tests).
  return {
    chainKey: activeChain().key,
    chain: activeChain(),
    chains: configuredChains(),
    setChainKey: () => {},
  };
}
