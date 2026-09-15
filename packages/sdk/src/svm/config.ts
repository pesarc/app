// Solana venue config for the prediction-market + P2P layer. Mirrors the EVM
// chain registry: env-driven, fails soft. Program ids default to the Anchor
// workspace's declared ids so the venue is turnkey once the programs are
// deployed to the selected cluster.
//
// Kept free of @solana/web3.js so it can be imported on the EVM path without
// pulling the Solana client into that bundle; the actual RPC client lives in
// markets.live.ts (loaded only when Solana is the active venue).

export type SvmCluster = "devnet" | "testnet" | "mainnet-beta";

export type SvmConfig = {
  cluster: SvmCluster;
  label: string;
  rpcUrl: string;
  explorer: string;
  /** prediction_market program id */
  predictionMarket: string;
  /** realized_rate_oracle program id */
  realizedOracle: string;
  /** collateral mint decimals (SPL default 6). */
  collateralDecimals: number;
};

// Declared program id from contracts/svm/target/idl (Anchor workspace).
const DEFAULT_PREDICTION_MARKET = "2aMC2CKjqwxmLrS6dv98c6pVYEKogRXxEuz3NZpzv8CZ";

const CLUSTER_RPC: Record<SvmCluster, string> = {
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};

function cluster(): SvmCluster {
  const c = (process.env.NEXT_PUBLIC_SVM_CLUSTER || "devnet").toLowerCase();
  return c === "mainnet-beta" || c === "testnet" || c === "devnet" ? (c as SvmCluster) : "devnet";
}

export function svmConfig(): SvmConfig {
  const cl = cluster();
  return {
    cluster: cl,
    label: cl === "mainnet-beta" ? "Solana" : `Solana ${cl}`,
    rpcUrl: process.env.NEXT_PUBLIC_SVM_RPC_URL || CLUSTER_RPC[cl],
    explorer: "https://explorer.solana.com",
    predictionMarket: process.env.NEXT_PUBLIC_SVM_PREDICTION_MARKET || DEFAULT_PREDICTION_MARKET,
    realizedOracle: process.env.NEXT_PUBLIC_SVM_REALIZED_ORACLE || "",
    collateralDecimals: Number(process.env.NEXT_PUBLIC_SVM_COLLATERAL_DECIMALS || 6),
  };
}

/** Explorer URL for a program/account on the active cluster. */
export function svmExplorerAccount(address: string, cfg = svmConfig()): string {
  const suffix = cfg.cluster === "mainnet-beta" ? "" : `?cluster=${cfg.cluster}`;
  return `${cfg.explorer}/address/${address}${suffix}`;
}

/** Explorer URL for a transaction signature on the active cluster. */
export function svmExplorerTx(signature: string, cfg = svmConfig()): string {
  const suffix = cfg.cluster === "mainnet-beta" ? "" : `?cluster=${cfg.cluster}`;
  return `${cfg.explorer}/tx/${signature}${suffix}`;
}
