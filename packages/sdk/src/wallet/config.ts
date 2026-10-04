// Wallet configuration. When NEXT_PUBLIC_PRIVY_APP_ID is set the app runs in
// "live" mode (Privy auth + Alchemy smart-wallet gasless sends on the hub
// chain); otherwise it stays in "mock" mode and behaves as the simulated demo.

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";

// Alchemy Wallet APIs (smart wallet client) + Gas Manager gasless sponsorship.
export const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "";
export const ALCHEMY_GAS_POLICY_ID =
  process.env.NEXT_PUBLIC_ALCHEMY_GAS_POLICY_ID || "";

// Per-chain Alchemy Gas Manager policy. Set a chain-specific policy to sponsor
// gas there; otherwise the default policy is used (which can itself cover
// multiple networks when configured that way in the Alchemy dashboard).
// NEXT_PUBLIC_* must be static literals to inline client-side.
export function gasPolicyFor(chainKey: string): string {
  const perChain: Record<string, string> = {
    "arbitrum-sepolia": process.env.NEXT_PUBLIC_ALCHEMY_GAS_POLICY_ID_ARB_SEPOLIA || "",
    "base-sepolia": process.env.NEXT_PUBLIC_ALCHEMY_GAS_POLICY_ID_BASE_SEPOLIA || "",
  };
  return perChain[chainKey] || ALCHEMY_GAS_POLICY_ID;
}

// Optional destination for testnet sends (demo recipients have no on-chain
// address). Falls back to a self-send when empty, which still proves the
// gasless on-chain path.
export const TEST_RECIPIENT = (process.env.NEXT_PUBLIC_TEST_RECIPIENT ||
  "") as "" | `0x${string}`;

// Ramp partner's escrow wallet: a Pesarc-controlled settlement account that is
// NOT any sender's wallet. A cash-out moves the user's USDC here on-chain (this
// is what debits them), and the payout orchestrator (lib/payouts.ts) pays the
// fiat leg from the float, replenished by the escrowed USDC. MUST be set per
// environment via NEXT_PUBLIC_RAMP_ESCROW — there is deliberately no default:
// an unset escrow fails the cash-out safety guard rather than silently sending
// the user's funds back to themselves (a no-op "debit" that still pays out).
export const RAMP_ESCROW = (process.env.NEXT_PUBLIC_RAMP_ESCROW || "") as
  | ""
  | `0x${string}`;

export const isWalletConfigured = Boolean(PRIVY_APP_ID);

// Gasless sends require both the Alchemy API key and a Gas Manager policy.
export const isSmartWalletConfigured = Boolean(
  ALCHEMY_API_KEY && ALCHEMY_GAS_POLICY_ID
);

// Auth mode (Path A rollout). "privy" (default) = Privy-native login modal
// (google/email/passkey/wallet). "own" = our phone-OTP + Privy custom-auth
// bridge (global SMS via Termii). Flip with NEXT_PUBLIC_AUTH_MODE=own once the
// Privy dashboard JWKS + Termii env are configured.
export const AUTH_MODE = (process.env.NEXT_PUBLIC_AUTH_MODE || "privy") as "privy" | "own";
