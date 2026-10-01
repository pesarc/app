// Session-key PERMISSION SCOPE + feature gate. Isomorphic (no secrets), safe in
// client and server. A session key lets the agent sign a NARROW set of calls on
// the user's behalf without a pop-up — here, a cross-chain USDC move: move at most
// `cap` USDC, and only by calling USDC (approve) and the CCTP TokenMessenger
// (burn). Everything else stays unauthorised, and the grant expires.
//
// Hard safety rails live here so no caller can bypass them:
//   - OFF by default. Enabled only when AGENT_SESSION_KEYS=1.
//   - Testnet ONLY. Mainnet is blocked in code regardless of the flag; delegated
//     signing of real funds must be audited first.

import type { GrantPermissionsParams } from "@alchemy/wallet-apis";
import { chainByKey } from "../../chain/registry";

/** Longest a grant may live — a short leash limits blast radius if a key leaks. */
export const MAX_EXPIRY_SEC = 24 * 60 * 60;

/** Default session length (unix expiry), capped at MAX_EXPIRY_SEC. */
export function defaultExpirySec(ttlSec = MAX_EXPIRY_SEC): number {
  return Math.floor(Date.now() / 1000) + Math.min(ttlSec, MAX_EXPIRY_SEC);
}

/** The flag. Accepts the server var or its NEXT_PUBLIC mirror (for the client). */
function flagOn(): boolean {
  const v = process.env.AGENT_SESSION_KEYS || process.env.NEXT_PUBLIC_AGENT_SESSION_KEYS || "";
  return v === "1" || v.toLowerCase() === "true";
}

/**
 * Whether the agent may use a session key on this chain right now. Requires the
 * flag AND a chain the registry marks as testnet. Mainnet is always false — the
 * single place that decision is made, so it cannot be worked around.
 */
export function sessionKeysAllowed(chainKey?: string): boolean {
  if (!flagOn() || !chainKey) return false;
  const cfg = chainByKey(chainKey);
  return Boolean(cfg?.testnet);
}

// Active registry chain key (testnet) -> CCTP network key. The move's source is
// always the chain the user holds a grant on. Isomorphic so client + server map
// the same way.
const REG_TO_CCTP: Record<string, string> = {
  "base-sepolia": "base",
  "arbitrum-sepolia": "arbitrum",
  "arc-testnet": "arc",
  "optimism-sepolia": "optimism",
  "polygon-amoy": "polygon",
  sepolia: "ethereum",
  "avalanche-fuji": "avalanche",
};

/** The CCTP network key for a registry chain key, or undefined if not a CCTP
 *  testnet chain. */
export function cctpKeyFor(registryKey?: string): string | undefined {
  return registryKey ? REG_TO_CCTP[registryKey] : undefined;
}

export type CrossChainScope = {
  /** The vault/transfer asset (USDC) on the source chain. */
  usdc: `0x${string}`;
  /** CCTP TokenMessenger the burn calls. */
  tokenMessenger: `0x${string}`;
  /** Max USDC the key may transfer over the grant's life, in token units (wei). */
  capWei: bigint;
  /** Gas the key may spend, in wei. Generous default; gas is sponsored anyway. */
  gasLimitWei?: bigint;
};

/**
 * The permission set for a cross-chain USDC grant, in the exact shape Alchemy's
 * wallet-apis expects (verified against @alchemy/wallet-api-types). An
 * erc20-token-transfer allowance caps how much USDC can move; contract-access
 * entries whitelist only USDC and the TokenMessenger; gas-limit bounds gas.
 */
export function buildCrossChainScope(s: CrossChainScope): GrantPermissionsParams["permissions"] {
  return [
    { type: "erc20-token-transfer", data: { address: s.usdc, allowance: s.capWei } },
    { type: "contract-access", data: { address: s.usdc } },
    { type: "contract-access", data: { address: s.tokenMessenger } },
    { type: "gas-limit", data: { limit: s.gasLimitWei ?? 2_000_000n } },
  ];
}
