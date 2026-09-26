// Production CCTP V2 (mainnet) configuration — the backbone of the non-custodial
// USDC bridge AND the Arc funding corridor. This is the OPPOSITE of the testnet
// demo in ../corridors.ts (which mints to a custodial hub): here a burn on the
// source chain mints native USDC straight to the recipient's wallet on the
// destination — no hub, no custody, Circle's own audited contracts.
//
// Sources (verify before first mainnet use; then test with ~$1 before any real
// amount):
//   Domains + support: https://developers.circle.com/cctp/concepts/supported-chains-and-domains
//   V2 contracts:      https://developers.circle.com/cctp/evm-smart-contracts
//   USDC address book: https://developers.circle.com/stablecoins/usdc-contract-addresses
//
// CCTP V2 uses ONE contract pair, identical across every EVM mainnet chain:
export const TOKEN_MESSENGER_V2 = "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d" as const;
export const MESSAGE_TRANSMITTER_V2 = "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64" as const;

export type CctpChainKind = "evm" | "solana";

export type CctpMainnetChain = {
  /** CCTP domain — the id used in burn/mint, NOT the EVM chain id. */
  domain: number;
  key: string;
  label: string;
  kind: CctpChainKind;
  /** EVM chain id (undefined for Solana). */
  chainId?: number;
  /** Native Circle USDC on this chain. */
  usdc: string;
  rpcEnv: string;
  explorerTx: (hash: string) => string;
};

// Only Circle-issued (native) USDC and CCTP-V2 mainnet chains. Arc (domain 26)
// is why funding + bridge converge: bridging USDC here lands native gas on Arc.
export const CCTP_MAINNET: Record<string, CctpMainnetChain> = {
  ethereum: {
    domain: 0, key: "ethereum", label: "Ethereum", kind: "evm", chainId: 1,
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    rpcEnv: "NEXT_PUBLIC_ETH_RPC_URL",
    explorerTx: (h) => `https://etherscan.io/tx/${h}`,
  },
  avalanche: {
    domain: 1, key: "avalanche", label: "Avalanche", kind: "evm", chainId: 43114,
    usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    rpcEnv: "NEXT_PUBLIC_AVAX_RPC_URL",
    explorerTx: (h) => `https://snowtrace.io/tx/${h}`,
  },
  optimism: {
    domain: 2, key: "optimism", label: "OP Mainnet", kind: "evm", chainId: 10,
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    rpcEnv: "NEXT_PUBLIC_OP_RPC_URL",
    explorerTx: (h) => `https://optimistic.etherscan.io/tx/${h}`,
  },
  arbitrum: {
    domain: 3, key: "arbitrum", label: "Arbitrum", kind: "evm", chainId: 42161,
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    rpcEnv: "NEXT_PUBLIC_ARB_RPC_URL",
    explorerTx: (h) => `https://arbiscan.io/tx/${h}`,
  },
  solana: {
    domain: 5, key: "solana", label: "Solana", kind: "solana",
    usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    rpcEnv: "NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL",
    explorerTx: (s) => `https://explorer.solana.com/tx/${s}`,
  },
  base: {
    domain: 6, key: "base", label: "Base", kind: "evm", chainId: 8453,
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    rpcEnv: "NEXT_PUBLIC_BASE_RPC_URL",
    explorerTx: (h) => `https://basescan.org/tx/${h}`,
  },
  polygon: {
    domain: 7, key: "polygon", label: "Polygon PoS", kind: "evm", chainId: 137,
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cc03d5c3359",
    rpcEnv: "NEXT_PUBLIC_POLYGON_RPC_URL",
    explorerTx: (h) => `https://polygonscan.com/tx/${h}`,
  },
  // Circle's Arc — USDC is the native gas token (predeploy). Bridging USDC here
  // over CCTP is exactly how you fund an Arc wallet for gas + deploy.
  arc: {
    domain: 26, key: "arc", label: "Arc", kind: "evm", chainId: 5042,
    usdc: "0x3600000000000000000000000000000000000000",
    rpcEnv: "NEXT_PUBLIC_ARC_RPC_URL",
    explorerTx: (h) => `https://explorer.arc.io/tx/${h}`,
  },
};

export const cctpChainByDomain = (domain: number) =>
  Object.values(CCTP_MAINNET).find((c) => c.domain === domain);

export const cctpChainByKey = (key: string): CctpMainnetChain | undefined =>
  CCTP_MAINNET[key];

/** Every route CCTP can settle natively (any source → any destination, incl. Arc). */
export const cctpRoutes = () => Object.values(CCTP_MAINNET);
