"use client";

// Bridges Privy's Solana embedded wallet to the byte-oriented SolanaSigner the
// SVM write path expects. Kept free of @solana/web3.js so it doesn't weigh down
// the core wallet bundle; the actual tx build lives in svm/write.ts (lazy).

import { createContext, useContext, useMemo } from "react";
import { useWallets, useSignTransaction } from "@privy-io/react-auth/solana";
import type { SolanaSigner } from "@pesarc/sdk/svm/write";

const SolanaSignerContext = createContext<SolanaSigner | null>(null);

/** Live provider — mount inside PrivyProvider. Exposes the first Solana wallet. */
export function LiveSolanaProvider({ children }: { children: React.ReactNode }) {
  const { wallets } = useWallets();
  const { signTransaction } = useSignTransaction();
  const wallet = wallets?.[0];

  const signer = useMemo<SolanaSigner | null>(() => {
    if (!wallet?.address) return null;
    return {
      address: wallet.address,
      signTransaction: async (bytes: Uint8Array) => {
        const { signedTransaction } = await signTransaction({ transaction: bytes, wallet });
        return signedTransaction;
      },
    };
  }, [wallet, signTransaction]);

  return (
    <SolanaSignerContext.Provider value={signer}>{children}</SolanaSignerContext.Provider>
  );
}

/** The connected Solana signer, or null (mock mode / no wallet yet). */
export function useSolanaSigner(): SolanaSigner | null {
  return useContext(SolanaSignerContext);
}
