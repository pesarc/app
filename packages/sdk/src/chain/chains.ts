// Chain / corridor registry for the testnet beta.
// Hub = Arbitrum (PRD §7.1). Testnet hub = Arbitrum Sepolia.
//
// NOTE: the hub contract suite lives in ../../contracts (Foundry). Deploy it
// to Arbitrum Sepolia with `forge script script/DeployStableArcHub.s.sol
// --rpc-url arbitrum_sepolia --broadcast` and paste the generated
// deployments/frontend.421614.env block into .env. The legacy *Ethereum*
// Sepolia deployment remains available via NEXT_PUBLIC_HUB_CHAIN_ID=11155111.

import { arbitrumSepolia, sepolia } from "viem/chains";
import { createPublicClient, http, type Chain } from "viem";

export const SUPPORTED_CHAINS = { arbitrumSepolia, sepolia } as const;

export type HubChainId = 421614 | 11155111;

// Default hub: Arbitrum Sepolia (override via env while contracts live on Sepolia).
export const HUB_CHAIN_ID: HubChainId = Number(
  process.env.NEXT_PUBLIC_HUB_CHAIN_ID || arbitrumSepolia.id
) as HubChainId;

export const HUB_CHAIN: Chain =
  HUB_CHAIN_ID === sepolia.id ? sepolia : arbitrumSepolia;

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

export function explorerTxUrl(txHash: string): string {
  const base =
    HUB_CHAIN_ID === sepolia.id
      ? "https://sepolia.etherscan.io/tx/"
      : "https://sepolia.arbiscan.io/tx/";
  return base + txHash;
}

export function explorerAddressUrl(address: string): string {
  const base =
    HUB_CHAIN_ID === sepolia.id
      ? "https://sepolia.etherscan.io/address/"
      : "https://sepolia.arbiscan.io/address/";
  return base + address;
}

export function chainLabel(): string {
  return HUB_CHAIN_ID === sepolia.id ? "Sepolia" : "Arbitrum Sepolia";
}
