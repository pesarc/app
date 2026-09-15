// Wallet configuration. When NEXT_PUBLIC_PRIVY_APP_ID is set the app runs in
// "live" mode (Privy auth + Alchemy smart-wallet gasless sends on the hub
// chain); otherwise it stays in "mock" mode and behaves as the simulated demo.

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";

// Alchemy Wallet APIs (smart wallet client) + Gas Manager gasless sponsorship.
export const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "";
export const ALCHEMY_GAS_POLICY_ID =
  process.env.NEXT_PUBLIC_ALCHEMY_GAS_POLICY_ID || "";

// Optional destination for testnet sends (demo recipients have no on-chain
// address). Falls back to a self-send when empty, which still proves the
// gasless on-chain path.
export const TEST_RECIPIENT = (process.env.NEXT_PUBLIC_TEST_RECIPIENT ||
  "") as "" | `0x${string}`;

// Sandbox ramp partner's escrow wallet: fiat payouts (bank / mobile money)
// deliver the swapped cNGN here on-chain, and the payout orchestrator
// (lib/payouts.ts) tracks the fiat leg. Defaults to the testnet operator.
export const RAMP_ESCROW = (process.env.NEXT_PUBLIC_RAMP_ESCROW ||
  "0xd4418f403F86De7DB7D1885d83A6d9A5bBf701F1") as `0x${string}`;

export const isWalletConfigured = Boolean(PRIVY_APP_ID);

// Gasless sends require both the Alchemy API key and a Gas Manager policy.
export const isSmartWalletConfigured = Boolean(
  ALCHEMY_API_KEY && ALCHEMY_GAS_POLICY_ID
);
