// Gas-sponsorship seam. Resolves, per hub chain, HOW gasless is paid for, so the
// provider is swappable without touching the smart-wallet layer — the same
// adapter pattern as ramp/bills/broker.
//
// Three shapes:
//   - alchemy : Alchemy Gas Manager (used on the testnets today; bundler +
//               paymaster in one, via @alchemy/wallet-apis).
//   - erc7677 : a standards-based ERC-7677 paymaster service (a bundler URL +
//               a paymaster-service URL). Circle Gas Station and our OWN
//               in-house paymaster both speak ERC-7677, so they are the same
//               shape here — only the URLs differ.
//   - none    : no sponsorship (user pays / mock).
//
// Pick per chain via env. On Arc (chainKey "arc"): NEXT_PUBLIC_GAS_SPONSOR_ARC
// = circle | inhouse | none (auto-detects from the URLs when unset). Testnets
// default to Alchemy when its key + a policy are configured.

import { ALCHEMY_API_KEY, gasPolicyFor } from "./config";

export type Erc7677Provider = "circle" | "inhouse" | "custom";

export type GasSponsor =
  | { kind: "none" }
  | { kind: "alchemy"; apiKey: string; policyId: string }
  | {
      kind: "erc7677";
      provider: Erc7677Provider;
      /** ERC-7677 paymaster service URL (pm_getPaymasterData / stub). */
      paymasterUrl: string;
      /** ERC-4337 bundler RPC URL for this chain. */
      bundlerUrl?: string;
      /** Optional paymaster context passed through to the service. */
      context?: Record<string, unknown>;
    };

function arcSponsor(): GasSponsor {
  const bundlerUrl = process.env.NEXT_PUBLIC_ARC_BUNDLER_URL || undefined;
  const circleUrl = process.env.NEXT_PUBLIC_CIRCLE_PAYMASTER_URL || "";
  // The in-house paymaster is this app's own ERC-7677 route once its contract
  // is deployed (address configured); default the URL to that same-origin route.
  const inhouseUrl =
    process.env.NEXT_PUBLIC_INHOUSE_PAYMASTER_URL ||
    (process.env.NEXT_PUBLIC_INHOUSE_PAYMASTER_ADDRESS ? "/api/paymaster" : "");

  const pick = (process.env.NEXT_PUBLIC_GAS_SPONSOR_ARC || "").toLowerCase();

  if ((pick === "circle" || (!pick && circleUrl)) && circleUrl) {
    return { kind: "erc7677", provider: "circle", paymasterUrl: circleUrl, bundlerUrl };
  }
  if ((pick === "inhouse" || (!pick && inhouseUrl)) && inhouseUrl) {
    return { kind: "erc7677", provider: "inhouse", paymasterUrl: inhouseUrl, bundlerUrl };
  }
  return { kind: "none" };
}

/** Resolve the gas sponsor for a chain (by its registry key, e.g. "arc"). */
export function getGasSponsor(chainKey: string): GasSponsor {
  if (chainKey === "arc") return arcSponsor();

  const policyId = gasPolicyFor(chainKey);
  if (ALCHEMY_API_KEY && policyId) {
    return { kind: "alchemy", apiKey: ALCHEMY_API_KEY, policyId };
  }
  return { kind: "none" };
}

/** Whether gasless sends are possible for a chain (any real sponsor resolves). */
export function gasSponsorConfigured(chainKey: string): boolean {
  return getGasSponsor(chainKey).kind !== "none";
}
