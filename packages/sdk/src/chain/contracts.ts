// Deployed contract + token addresses per hub chain.
//
// - Sepolia (11155111): REAL addresses from the existing deployment
//   (goldgard-hookathon/frontend/app/config/demoConfig.sepolia.json).
//   token0/token1 act as the test USDC / test-cNGN pair.
// - Arbitrum Sepolia (421614): REAL addresses from the Pesarc hub
//   deployment (contracts/deployments/frontend.421614.env), read from env.

import { HUB_CHAIN_ID } from "./chains";

export type ContractSet = {
  poolManager: `0x${string}` | "";
  hook: `0x${string}` | "";
  swapRouter: `0x${string}` | "";
  liquidityRouter: `0x${string}` | "";
  safetyModule: `0x${string}` | "";
  oracleAdapter: `0x${string}` | "";
  stateView: `0x${string}` | "";
  /** test USDC (send leg) — pool currency0 */
  tokenUsd: `0x${string}` | "";
  /** test cNGN (receive leg) — pool currency1 */
  tokenNgn: `0x${string}` | "";
  /** v4 PoolKey params */
  fee: number;
  tickSpacing: number;
  /** V4Quoter lens — exact all-in quotes via eth_call (empty = mock quotes only). */
  quoter: `0x${string}` | "";
  /** SettlementNetting — multilateral net settlement for Business/Settle. */
  settlementNetting: `0x${string}` | "";
  /** IntentMatcher — local-currency P2P settlement (zero USD). */
  intentMatcher: `0x${string}` | "";
  /** RealizedRateOracle — self-referential price discovery from settled flow. */
  realizedRateOracle: `0x${string}` | "";
  /** Local stable: Ghana cedi (corridor leg). */
  tokenGhs: `0x${string}` | "";
  /** Local stable: Kenyan shilling (corridor leg). */
  tokenKes: `0x${string}` | "";
  /** Block the hub was deployed at — start of on-chain history scans. */
  deployBlock: bigint;
  /** Block the IntentMatcher/oracle were deployed at — scans start here so
   *  log ranges stay inside provider limits. */
  matcherDeployBlock: bigint;
  /** Block the HubBridgeReceiver was deployed at — start of CCTP deposit scans.
   *  Must not use the matcher's block: deposits predate it, and scanning from
   *  the later block would under-report dollar-touched volume. */
  bridgeDeployBlock: bigint;
};

const SEPOLIA: ContractSet = {
  poolManager: "0x80Fe0Ec30c29B0C4c996b463B6869060b7C74A75",
  hook: "0x9165e5eC71D2815D6681F96364a10eD708AB85c4",
  swapRouter: "0xa088341c5FaD8115b2bc6B503467e39b47D45936",
  liquidityRouter: "0xc681824A10B402F020dd7f0C4ad3761129910947",
  safetyModule: "0x62471b05d0F4fBb9DF314406b79F433f1EC818B0",
  oracleAdapter: "0xceB20161C104C87aAe2664dCB5aA5Ca000de6b62",
  stateView: "0xae272EaC98C831b4F6d0e88D0D362ad706794CcD",
  tokenUsd: "0x6f1947c64569BC394Ccb312eFE12AA7AA7c49FDa", // token0
  tokenNgn: "0xD2B4047843Ea81Bff25CC022cC045888A93F3fa2", // token1
  fee: 8388608, // dynamic-fee flag (hook sets the fee)
  tickSpacing: 60,
  quoter: "", // no quoter lens on the legacy Sepolia deployment
  settlementNetting: "",
  intentMatcher: "",
  realizedRateOracle: "",
  tokenGhs: "",
  tokenKes: "",
  deployBlock: 0n,
  matcherDeployBlock: 0n,
  bridgeDeployBlock: 0n,
};

// Pesarc hub deployment (contracts/ → DeployPesarcHub.s.sol), via env.
const ARBITRUM_SEPOLIA: ContractSet = {
  poolManager: (process.env.NEXT_PUBLIC_ARB_POOL_MANAGER as `0x${string}`) || "",
  hook: (process.env.NEXT_PUBLIC_ARB_HOOK as `0x${string}`) || "",
  swapRouter: (process.env.NEXT_PUBLIC_ARB_SWAP_ROUTER as `0x${string}`) || "",
  liquidityRouter:
    (process.env.NEXT_PUBLIC_ARB_LIQUIDITY_ROUTER as `0x${string}`) || "",
  safetyModule:
    (process.env.NEXT_PUBLIC_ARB_SAFETY_MODULE as `0x${string}`) || "",
  oracleAdapter:
    (process.env.NEXT_PUBLIC_ARB_ORACLE_ADAPTER as `0x${string}`) || "",
  stateView: (process.env.NEXT_PUBLIC_ARB_STATE_VIEW as `0x${string}`) || "",
  tokenUsd: (process.env.NEXT_PUBLIC_ARB_TOKEN_USD as `0x${string}`) || "",
  tokenNgn: (process.env.NEXT_PUBLIC_ARB_TOKEN_NGN as `0x${string}`) || "",
  fee: Number(process.env.NEXT_PUBLIC_ARB_POOL_FEE || 8388608),
  tickSpacing: Number(process.env.NEXT_PUBLIC_ARB_TICK_SPACING || 60),
  quoter: (process.env.NEXT_PUBLIC_ARB_QUOTER as `0x${string}`) || "",
  settlementNetting:
    (process.env.NEXT_PUBLIC_ARB_SETTLEMENT_NETTING as `0x${string}`) || "",
  intentMatcher:
    (process.env.NEXT_PUBLIC_ARB_INTENT_MATCHER as `0x${string}`) || "",
  realizedRateOracle:
    (process.env.NEXT_PUBLIC_ARB_REALIZED_ORACLE as `0x${string}`) || "",
  tokenGhs: (process.env.NEXT_PUBLIC_ARB_TOKEN_GHS as `0x${string}`) || "",
  tokenKes: (process.env.NEXT_PUBLIC_ARB_TOKEN_KES as `0x${string}`) || "",
  deployBlock: BigInt(process.env.NEXT_PUBLIC_ARB_DEPLOY_BLOCK || 284002614),
  matcherDeployBlock: BigInt(
    process.env.NEXT_PUBLIC_ARB_MATCHER_BLOCK || 287732689,
  ),
  bridgeDeployBlock: BigInt(
    process.env.NEXT_PUBLIC_ARB_BRIDGE_BLOCK || 287622810,
  ),
};

export const CONTRACTS: ContractSet =
  HUB_CHAIN_ID === 11155111 ? SEPOLIA : ARBITRUM_SEPOLIA;

/** True once the hub chain has a usable deployment wired up. */
export const CONTRACTS_READY = Boolean(CONTRACTS.swapRouter && CONTRACTS.tokenUsd);
