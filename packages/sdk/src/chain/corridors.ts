// CCTP V2 corridor registry: spoke chains that feed native USDC into the
// Arbitrum hub (Engineering Spec v0.3 §2.1 Wave 1). Live testnet deployments.

import { sepolia, baseSepolia } from "viem/chains";
import type { Chain } from "viem";

export type Corridor = {
  chain: Chain;
  label: string;
  /** CCTP domain of the spoke. */
  domain: number;
  /** SpokeGateway on the spoke chain. */
  gateway: `0x${string}`;
  /** Native (Circle) USDC on the spoke chain. */
  usdc: `0x${string}`;
  rpcUrl: string;
  explorerTx: (hash: string) => string;
};

export const CORRIDORS: Record<number, Corridor> = {
  [sepolia.id]: {
    chain: sepolia,
    label: "Ethereum Sepolia",
    domain: 0,
    gateway:
      (process.env.NEXT_PUBLIC_ETH_SEPOLIA_GATEWAY as `0x${string}`) ||
      "0x4b52aB571F915708895dF4B2b914a5aFbc026aD3",
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    rpcUrl:
      process.env.NEXT_PUBLIC_ETH_SEPOLIA_RPC_URL ||
      "https://ethereum-sepolia-rpc.publicnode.com",
    explorerTx: (h) => `https://sepolia.etherscan.io/tx/${h}`,
  },
  [baseSepolia.id]: {
    chain: baseSepolia,
    label: "Base Sepolia",
    domain: 6,
    gateway:
      (process.env.NEXT_PUBLIC_BASE_SEPOLIA_GATEWAY as `0x${string}`) ||
      "0x53173E10ba1429d58706D629C889b2bDD7D21C47",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    rpcUrl:
      process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
    explorerTx: (h) => `https://sepolia.basescan.org/tx/${h}`,
  },
};

export function corridorByDomain(domain: number): Corridor | undefined {
  return Object.values(CORRIDORS).find((c) => c.domain === domain);
}

/**
 * Solana devnet corridor (Wave 3). Not an EVM chain, so it lives outside
 * CORRIDORS; the relayer branches on this sentinel chain id.
 */
export const SOLANA_CHAIN_ID = 103; // conventional id for Solana devnet
export const SOLANA_CORRIDOR = {
  chainId: SOLANA_CHAIN_ID,
  label: "Solana Devnet",
  domain: 5,
  /** StableArc spoke-gateway Anchor program. */
  gateway:
    process.env.NEXT_PUBLIC_SOLANA_GATEWAY ||
    "Gi1uEn2LbSm8xM9LXpyZ5ZSbiqhLsqQ7ntgM33pbT2Ki",
  /** Circle devnet USDC mint. */
  usdc: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  rpcUrl:
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com",
  explorerTx: (sig: string) =>
    `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
} as const;

/** sha256("event:IntentCreated")[0..8] — Anchor event discriminator. */
export const SOLANA_INTENT_EVENT_DISC = [184, 46, 156, 205, 169, 254, 11, 108];

/** HubBridgeReceiver on the hub (Arbitrum Sepolia). */
export const HUB_BRIDGE_RECEIVER =
  (process.env.NEXT_PUBLIC_ARB_BRIDGE_RECEIVER as `0x${string}`) ||
  "0xe7155253eDc1337F24D778A66e4069faf3f7Fa1a";

/** CCTP V2 MessageTransmitter (same proxy address on all EVM testnets). */
export const MESSAGE_TRANSMITTER =
  "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as const;

export const IRIS_API = "https://iris-api-sandbox.circle.com";

export const spokeGatewayAbi = [
  {
    type: "function",
    name: "sendToHub",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "hubRecipient", type: "address" },
      { name: "convertToLocal", type: "bool" },
      { name: "maxFee", type: "uint256" },
      { name: "reference_", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "IntentCreated",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "hubRecipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "convertToLocal", type: "bool", indexed: false },
      { name: "reference_", type: "bytes32", indexed: false },
    ],
  },
] as const;

export const messageTransmitterAbi = [
  {
    type: "function",
    name: "receiveMessage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "message", type: "bytes" },
      { name: "attestation", type: "bytes" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
] as const;

export const bridgeReceiverAbi = [
  {
    type: "function",
    name: "unprocessedReserve6",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "processDeposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "sourceDomain", type: "uint32" },
      { name: "recipient", type: "address" },
      { name: "amount6", type: "uint256" },
      { name: "convertToLocal", type: "bool" },
      { name: "minNgnOut", type: "uint256" },
      { name: "reference_", type: "bytes32" },
    ],
    outputs: [{ name: "ngnOut", type: "uint256" }],
  },
] as const;
