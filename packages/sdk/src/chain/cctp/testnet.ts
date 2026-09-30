// CCTP V2 TESTNET configuration — the faucet-USDC mirror of ./mainnet.ts, so the
// cross-chain mover can be dry-run end to end (Arc Sepolia <-> Polygon Amoy <->
// Base Sepolia, etc.) before a cent of real USDC moves. Non-custodial, identical
// flow to mainnet: burn on the source, Circle's SANDBOX attestation service, then
// the relayer mints on the destination.
//
// Addresses verified against Circle + Arc docs (2026-09):
//   Contracts:  https://developers.circle.com/cctp/evm-smart-contracts
//   Testnet USDC: https://developers.circle.com/stablecoins/usdc-contract-addresses
//   Arc:        https://docs.arc.io/arc/references/contract-addresses
//
// CCTP V2 testnet uses ONE contract pair, identical across every testnet chain
// (Arc testnet included — it shares the standard testnet messenger, unlike Arc
// mainnet which has its own):
import type { CctpChain } from "./mainnet";

export const TOKEN_MESSENGER_V2_TESTNET =
  "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as const;
export const MESSAGE_TRANSMITTER_V2_TESTNET =
  "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as const;

// EVM-only for this phase (Solana/Algorand cross-chain stay mainnet — their
// testnet routers aren't wired). Domain numbers match mainnet; only the chain
// ids, USDC addresses and explorers differ.
export const CCTP_TESTNET: Record<string, CctpChain> = {
  ethereum: {
    domain: 0, key: "ethereum", label: "Ethereum Sepolia", kind: "evm", chainId: 11155111,
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    rpcEnv: "NEXT_PUBLIC_ETH_SEPOLIA_RPC_URL",
    explorerTx: (h) => `https://sepolia.etherscan.io/tx/${h}`,
  },
  avalanche: {
    domain: 1, key: "avalanche", label: "Avalanche Fuji", kind: "evm", chainId: 43113,
    usdc: "0x5425890298aed601595a70AB815c96711a31Bc65",
    rpcEnv: "NEXT_PUBLIC_AVAX_FUJI_RPC_URL",
    explorerTx: (h) => `https://testnet.snowtrace.io/tx/${h}`,
  },
  optimism: {
    domain: 2, key: "optimism", label: "OP Sepolia", kind: "evm", chainId: 11155420,
    usdc: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
    rpcEnv: "NEXT_PUBLIC_OP_SEPOLIA_RPC_URL",
    explorerTx: (h) => `https://sepolia-optimism.etherscan.io/tx/${h}`,
  },
  arbitrum: {
    domain: 3, key: "arbitrum", label: "Arbitrum Sepolia", kind: "evm", chainId: 421614,
    usdc: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    rpcEnv: "NEXT_PUBLIC_ARB_SEPOLIA_RPC_URL",
    explorerTx: (h) => `https://sepolia.arbiscan.io/tx/${h}`,
  },
  base: {
    domain: 6, key: "base", label: "Base Sepolia", kind: "evm", chainId: 84532,
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    rpcEnv: "NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL",
    explorerTx: (h) => `https://sepolia.basescan.org/tx/${h}`,
  },
  polygon: {
    domain: 7, key: "polygon", label: "Polygon Amoy", kind: "evm", chainId: 80002,
    usdc: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
    rpcEnv: "NEXT_PUBLIC_POLYGON_AMOY_RPC_URL",
    explorerTx: (h) => `https://amoy.polygonscan.com/tx/${h}`,
  },
  // Arc's USDC is the native gas token (fixed predeploy address, same on both
  // networks); bridging USDC here over CCTP is how you fund an Arc testnet wallet.
  arc: {
    domain: 26, key: "arc", label: "Arc Testnet", kind: "evm", chainId: 5042002,
    usdc: "0x3600000000000000000000000000000000000000",
    rpcEnv: "NEXT_PUBLIC_ARC_TESTNET_RPC_URL",
    explorerTx: (h) => `https://explorer.testnet.arc.io/tx/${h}`,
  },
};
