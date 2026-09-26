// Chain / corridor registry for the testnet beta.
// Hub = Arbitrum (PRD §7.1). Testnet hub = Arbitrum Sepolia.
//
// NOTE: the hub contract suite lives in ../../contracts (Foundry). Deploy it
// to Arbitrum Sepolia with `forge script script/DeployPesarcHub.s.sol
// --rpc-url arbitrum_sepolia --broadcast` and paste the generated
// deployments/frontend.421614.env block into .env. The legacy *Ethereum*
// Sepolia deployment remains available via NEXT_PUBLIC_HUB_CHAIN_ID=11155111.

import { arbitrumSepolia, sepolia } from "viem/chains";
import { createPublicClient, http, type Chain } from "viem";

// Arc mainnet — Circle's stablecoin L1 where USDC is the gas token. Not in
// viem/chains yet, so defined here. RPC + explorer are env-overridable so the
// exact endpoints can be corrected without a code change.
export const ARC_MAINNET_ID = 5042 as const;
export const arcMainnet: Chain = {
  id: ARC_MAINNET_ID,
  name: "Arc",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.mainnet.arc.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arc Explorer",
      url: process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || "https://explorer.arc.io",
    },
  },
};

export const SUPPORTED_CHAINS = { arbitrumSepolia, sepolia, arcMainnet } as const;

export type HubChainId = 421614 | 11155111 | 5042;

// Default hub: Arbitrum Sepolia. Set NEXT_PUBLIC_HUB_CHAIN_ID=5042 to run on Arc
// mainnet (once the hub contracts are deployed there — see docs/ARC_SUBMISSION.md).
export const HUB_CHAIN_ID: HubChainId = Number(
  process.env.NEXT_PUBLIC_HUB_CHAIN_ID || arbitrumSepolia.id
) as HubChainId;

/** True when the hub is running on Arc mainnet. */
export const IS_ARC = HUB_CHAIN_ID === ARC_MAINNET_ID;

export const HUB_CHAIN: Chain =
  HUB_CHAIN_ID === sepolia.id
    ? sepolia
    : HUB_CHAIN_ID === ARC_MAINNET_ID
      ? arcMainnet
      : arbitrumSepolia;

/** RPC URL for the hub chain (falls back to the chain's public RPC). */
export function hubRpcUrl(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_HUB_RPC_URL ||
    HUB_CHAIN.rpcUrls.default.http[0]
  );
}

/** Read-only viem client for the hub chain (balances, quotes, calls). */
export function getPublicClient() {
  return createPublicClient({
    chain: HUB_CHAIN,
    transport: http(hubRpcUrl()),
  });
}

/**
 * RPC used for `eth_getLogs` only.
 *
 * Our Alchemy endpoint rejects viem's getLogs ("JSON is not a valid request
 * object") while serving every other method fine, so log queries go to a
 * provider known to handle them. Override with NEXT_PUBLIC_LOGS_RPC_URL.
 */
export function logsRpcUrl(): string {
  if (process.env.NEXT_PUBLIC_LOGS_RPC_URL) {
    return process.env.NEXT_PUBLIC_LOGS_RPC_URL;
  }
  if (IS_ARC) return hubRpcUrl() ?? arcMainnet.rpcUrls.default.http[0];
  return HUB_CHAIN_ID === sepolia.id
    ? "https://ethereum-sepolia-rpc.publicnode.com"
    : "https://sepolia-rollup.arbitrum.io/rpc";
}

/** Client for event/log queries. Use this for anything calling getLogs. */
export function getLogsClient() {
  return createPublicClient({
    chain: HUB_CHAIN,
    transport: http(logsRpcUrl()),
  });
}

function explorerBase(): string {
  if (IS_ARC) return arcMainnet.blockExplorers!.default.url.replace(/\/$/, "");
  return HUB_CHAIN_ID === sepolia.id
    ? "https://sepolia.etherscan.io"
    : "https://sepolia.arbiscan.io";
}

export function explorerTxUrl(txHash: string): string {
  return `${explorerBase()}/tx/${txHash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${explorerBase()}/address/${address}`;
}

export function chainLabel(): string {
  return HUB_CHAIN_ID === sepolia.id
    ? "Sepolia"
    : IS_ARC
      ? "Arc"
      : "Arbitrum Sepolia";
}
