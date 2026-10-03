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
import { ARC_MAINNET_ID } from "../chain/chains";

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

function pimlicoUrl(chainId: number): string {
  const key = process.env.NEXT_PUBLIC_PIMLICO_API_KEY || "";
  return key ? `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${key}` : "";
}

function arcSponsor(chainId: number): GasSponsor {
  // Bundler: an explicit URL, else Pimlico (built from the key) — the Arc-
  // recommended bundler.
  const bundlerUrl = process.env.NEXT_PUBLIC_ARC_BUNDLER_URL || pimlicoUrl(chainId) || undefined;

  // Gas mode. "user" (the DEFAULT) = the user pays their own gas in the chain's
  // gas token, via a bundler with NO paymaster, so the operator funds no gas.
  // On Arc the gas token is USDC, so the user pays fees in the same stablecoin
  // they transact — never "free", never operator-sponsored. Set
  // NEXT_PUBLIC_GAS_MODE=sponsored only to deliberately re-enable a paymaster.
  const gasMode = (process.env.NEXT_PUBLIC_GAS_MODE || "user").toLowerCase();
  if (gasMode === "user") {
    return bundlerUrl
      ? { kind: "erc7677", provider: "custom", paymasterUrl: "", bundlerUrl }
      : { kind: "none" };
  }

  const circleUrl = process.env.NEXT_PUBLIC_CIRCLE_PAYMASTER_URL || "";
  const inhouseUrl =
    process.env.NEXT_PUBLIC_INHOUSE_PAYMASTER_URL ||
    (process.env.NEXT_PUBLIC_INHOUSE_PAYMASTER_ADDRESS ? "/api/paymaster" : "");
  // Pimlico paymaster: the same v2 URL sponsors with just the key (verified
  // gasless on Arc testnet). A sponsorship policy id is optional (needed to
  // scope/fund sponsorship, e.g. on mainnet); passed as context when present.
  const pimPmUrl = pimlicoUrl(chainId);
  const pimPolicy = process.env.NEXT_PUBLIC_PIMLICO_SPONSORSHIP_POLICY_ID || "";

  const pick = (process.env.NEXT_PUBLIC_GAS_SPONSOR_ARC || "").toLowerCase();

  // The in-house paymaster is deployed only on Arc MAINNET; its address holds no
  // contract on Arc testnet (5042002), so never select it off mainnet - fall back
  // to Pimlico there (it sponsors Arc testnet with the bundler key).
  const inhouseHere = Boolean(inhouseUrl) && chainId === ARC_MAINNET_ID;

  const circle = (): GasSponsor | null =>
    circleUrl ? { kind: "erc7677", provider: "circle", paymasterUrl: circleUrl, bundlerUrl } : null;
  const pimlico = (): GasSponsor | null =>
    pimPmUrl
      ? {
          kind: "erc7677",
          provider: "custom",
          paymasterUrl: pimPmUrl,
          bundlerUrl,
          ...(pimPolicy ? { context: { sponsorshipPolicyId: pimPolicy } } : {}),
        }
      : null;
  const inhouse = (): GasSponsor | null =>
    inhouseHere ? { kind: "erc7677", provider: "inhouse", paymasterUrl: inhouseUrl, bundlerUrl } : null;

  if (pick === "circle") return circle() ?? { kind: "none" };
  if (pick === "pimlico") return pimlico() ?? { kind: "none" };
  // Explicit in-house: use it on mainnet; on testnet fall back to Pimlico.
  if (pick === "inhouse") return inhouse() ?? pimlico() ?? { kind: "none" };
  // Auto-detect (no pick): Circle, then Pimlico, then in-house (mainnet only).
  return circle() ?? pimlico() ?? inhouse() ?? { kind: "none" };
}

/** Resolve the gas sponsor for a chain (registry key + numeric chain id). */
export function getGasSponsor(chainKey: string, chainId = 5042): GasSponsor {
  // Every Arc chain (mainnet "arc" AND testnet "arc-testnet") uses the ERC-7677
  // SimpleAccount path — NOT Alchemy's EIP-7702. Matching only "arc" let Arc
  // testnet fall through to the Alchemy branch, which then tried to sign an
  // EIP-7702 authorization (unsupported by external wallets) on the Arc leg.
  if (chainKey === "arc" || chainKey.startsWith("arc-")) return arcSponsor(chainId);

  const policyId = gasPolicyFor(chainKey);
  if (ALCHEMY_API_KEY && policyId) {
    return { kind: "alchemy", apiKey: ALCHEMY_API_KEY, policyId };
  }
  return { kind: "none" };
}

/** Whether gasless sends are possible for a chain (any real sponsor resolves). */
export function gasSponsorConfigured(chainKey: string, chainId?: number): boolean {
  return getGasSponsor(chainKey, chainId).kind !== "none";
}
