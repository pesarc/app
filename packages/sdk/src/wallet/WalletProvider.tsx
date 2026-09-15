"use client";

import { createContext, useContext, useMemo } from "react";
import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { HUB_CHAIN } from "@pesarc/sdk/chain/chains";
import { ALIAS } from "@pesarc/sdk/account";
import { PRIVY_APP_ID, isWalletConfigured } from "./config";
import {
  LiveSmartWalletProvider,
  MockSmartWalletProvider,
} from "./smart-wallet";

export type WalletMode = "mock" | "live";

export type WalletState = {
  mode: WalletMode;
  /** Privy/SDK finished initialising. */
  ready: boolean;
  authenticated: boolean;
  address?: string;
  /** Human alias shown in the UI (phone/@handle resolves to the wallet). */
  alias: string;
  login: () => void;
  logout: () => void;
};

const WalletContext = createContext<WalletState | null>(null);

/* ----------------------------- Mock mode ----------------------------- */
// No keys configured: keep the simulated demo working unchanged.

function MockWalletProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<WalletState>(
    () => ({
      mode: "mock",
      ready: true,
      authenticated: true,
      address: undefined,
      alias: ALIAS,
      login: () => {},
      logout: () => {},
    }),
    []
  );
  return (
    <WalletContext.Provider value={value}>
      <MockSmartWalletProvider>{children}</MockSmartWalletProvider>
    </WalletContext.Provider>
  );
}

/* ----------------------------- Live mode ----------------------------- */
// Privy: passkey / phone / social sign-up provisions an embedded wallet; a
// smart account (ERC-4337) + paymaster gasless sponsorship are enabled in the
// Privy dashboard. B3 swaps the mock balances/quote for on-chain reads/writes.

function LiveWalletBridge({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();

  const value = useMemo<WalletState>(() => {
    const address = wallets?.[0]?.address ?? user?.wallet?.address ?? undefined;
    return {
      mode: "live",
      ready,
      authenticated,
      address,
      alias: ALIAS,
      login,
      logout,
    };
  }, [ready, authenticated, user, wallets, login, logout]);

  return (
    <WalletContext.Provider value={value}>
      <LiveSmartWalletProvider>{children}</LiveSmartWalletProvider>
    </WalletContext.Provider>
  );
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  if (!isWalletConfigured) {
    return <MockWalletProvider>{children}</MockWalletProvider>;
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // PRD W1: phone/passkey/social, no seed phrase.
        loginMethods: ["sms", "passkey", "email", "google"],
        embeddedWallets: {
          // Alchemy smart-wallet client needs an embedded wallet to sign.
          ethereum: { createOnLogin: "all-users" },
          showWalletUIs: false,
        },
        defaultChain: HUB_CHAIN,
        supportedChains: [HUB_CHAIN],
        appearance: {
          theme: "light",
          accentColor: "#EA580C",
          logo: undefined,
        },
      }}
    >
      <LiveWalletBridge>{children}</LiveWalletBridge>
    </PrivyProvider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within <WalletProvider>");
  return ctx;
}
