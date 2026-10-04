"use client";

import { createContext, useContext, useMemo } from "react";
import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { HUB_CHAIN } from "@pesarc/sdk/chain/chains";
import { ALIAS } from "@pesarc/sdk/account";
import { PRIVY_APP_ID, isWalletConfigured, AUTH_MODE } from "./config";
import {
  LiveSmartWalletProvider,
  MockSmartWalletProvider,
} from "./smart-wallet";
import { LiveSolanaProvider } from "./solana";

export type WalletMode = "mock" | "live";

export type WalletState = {
  mode: WalletMode;
  /** Privy/SDK finished initialising. */
  ready: boolean;
  authenticated: boolean;
  /** The ACTIVE address — the linked external wallet (MetaMask) when one is
   *  connected, else the embedded wallet. This is the account the app funds
   *  from and reads balances for. */
  address?: string;
  /** The linked external wallet's address, if the user connected one. Lets the
   *  UI show "wallet connected" vs offer to connect. */
  externalAddress?: string;
  /** Human alias shown in the UI (phone/@handle resolves to the wallet). */
  alias: string;
  login: () => void;
  logout: () => void;
  /** Link an external wallet (MetaMask/WalletConnect) to the CURRENT account,
   *  so one identity can hold funds in a self-custody wallet. No-op in mock. */
  linkWallet: () => void;
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
      externalAddress: undefined,
      alias: ALIAS,
      login: () => {},
      logout: () => {},
      linkWallet: () => {},
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
  const { ready, authenticated, user, login, logout, linkWallet } = usePrivy();
  const { wallets } = useWallets();

  const value = useMemo<WalletState>(() => {
    // A connected external wallet (MetaMask etc.) is the one that holds the
    // user's funds, so it's the active account — mirror smart-wallet.tsx, which
    // also prefers it. Fall back to the embedded wallet when none is linked.
    const external = wallets?.find((w) => w.walletClientType !== "privy" && w.address);
    const address = external?.address ?? wallets?.[0]?.address ?? user?.wallet?.address ?? undefined;
    return {
      mode: "live",
      ready,
      authenticated,
      address,
      externalAddress: external?.address,
      alias: ALIAS,
      login,
      logout,
      linkWallet,
    };
  }, [ready, authenticated, user, wallets, login, logout, linkWallet]);

  return (
    <WalletContext.Provider value={value}>
      <LiveSolanaProvider>
        <LiveSmartWalletProvider>{children}</LiveSmartWalletProvider>
      </LiveSolanaProvider>
    </WalletContext.Provider>
  );
}

/* ------------------------- Own-auth mode (Path A) ------------------------- */
// Identity comes from our phone-OTP -> signed session -> short access token.
// Privy validates the token against our JWKS (set in the Privy dashboard) and
// provisions the embedded wallet; there is no Privy login modal. Sign-in UI is
// <PhoneSignIn/>, rendered by AuthGate when unauthenticated.

function OwnAuthBridge({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, logout: privyLogout, linkWallet } = usePrivy();
  const { wallets } = useWallets();

  const value = useMemo<WalletState>(
    () => {
    const external = wallets?.find((w) => w.walletClientType !== "privy" && w.address);
    return {
      mode: "live",
      ready,
      authenticated,
      address: external?.address ?? wallets?.[0]?.address ?? user?.wallet?.address ?? undefined,
      externalAddress: external?.address,
      alias: ALIAS,
      login: () => {}, // AuthGate shows <PhoneSignIn/> when unauthenticated
      linkWallet,
      logout: async () => {
        try {
          await fetch("/api/auth/session", { method: "DELETE" });
        } catch {}
        try {
          await privyLogout();
        } catch {}
        if (typeof window !== "undefined") window.location.reload();
      },
    };
    },
    [ready, authenticated, user, wallets, privyLogout, linkWallet],
  );

  return (
    <WalletContext.Provider value={value}>
      <LiveSolanaProvider>
        <LiveSmartWalletProvider>{children}</LiveSmartWalletProvider>
      </LiveSolanaProvider>
    </WalletContext.Provider>
  );
}

function OwnAuthWalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Bring-your-own JWT: Privy calls this to get our access token, verifies
        // it against our JWKS, and authenticates + provisions the wallet.
        customAuth: {
          isLoading: false,
          getCustomAccessToken: async () => {
            try {
              const r = await fetch("/api/auth/session");
              if (!r.ok) return undefined;
              const d = (await r.json()) as { token?: string };
              return typeof d.token === "string" ? d.token : undefined;
            } catch {
              return undefined;
            }
          },
        },
        embeddedWallets: {
          ethereum: { createOnLogin: "all-users" },
          solana: { createOnLogin: "all-users" },
          showWalletUIs: false,
        },
        defaultChain: HUB_CHAIN,
        supportedChains: [HUB_CHAIN],
        appearance: {
          theme: "light",
          accentColor: "#2e96ff",
          walletChainType: "ethereum-and-solana",
          logo: undefined,
        },
      }}
    >
      <OwnAuthBridge>{children}</OwnAuthBridge>
    </PrivyProvider>
  );
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  if (!isWalletConfigured) {
    return <MockWalletProvider>{children}</MockWalletProvider>;
  }

  if (AUTH_MODE === "own") {
    return <OwnAuthWalletProvider>{children}</OwnAuthWalletProvider>;
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Sign-in: Google, email, passkey — no seed phrase — plus an optional
        // external wallet (MetaMask/Phantom/WalletConnect) for crypto-native
        // users. Embedded wallets are still created for everyone (createOnLogin
        // below), so the gasless smart-account flow works either way. External
        // wallets must also be enabled in the Privy dashboard.
        //
        // Privy's built-in `sms` is intentionally OMITTED: its phone-OTP only
        // covers US/Canada, which is a dead end for our NG/GH/KE users. Global
        // phone login is handled by our own OTP provider + Privy custom auth —
        // see docs/AUTH_OWN_STACK.md (Path A).
        loginMethods: ["google", "email", "passkey", "wallet"],
        embeddedWallets: {
          // Alchemy smart-wallet client needs an EVM embedded wallet to sign;
          // the Solana embedded wallet powers on-chain staking on the SVM venue.
          ethereum: { createOnLogin: "all-users" },
          solana: { createOnLogin: "all-users" },
          showWalletUIs: false,
        },
        defaultChain: HUB_CHAIN,
        supportedChains: [HUB_CHAIN],
        appearance: {
          theme: "light",
          accentColor: "#2e96ff",
          walletChainType: "ethereum-and-solana",
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
