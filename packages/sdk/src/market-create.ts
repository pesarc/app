// On-chain prediction-market creation (owner path). `createMarket` on
// PredictionMarket.sol is onlyOwner, so a community proposal is created on the
// user's behalf by the protocol owner key (server-side). Binary markets only —
// the contract is Yes/No; multi-outcome stays store-backed.
//
// Targets the markets chain (Arb Sepolia by default), whose deployed market is
// owned by the operator key we hold. Activated by MARKET_OWNER_PK (falls back
// to SETTLE_OPERATOR_PK). Until a key is present the propose route falls back to
// the off-chain store.

import { createWalletClient, createPublicClient, http, parseUnits, zeroAddress } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const ZERO = zeroAddress as `0x${string}`;
const ZERO_BYTES32 = `0x${"0".repeat(64)}` as `0x${string}`;

// createMarket + helpers. Source is a 7-field tuple (note the trailing feedRef).
const MARKET_ABI = [
  {
    type: "function",
    name: "createMarket",
    stateMutability: "nonpayable",
    inputs: [
      { name: "question", type: "string" },
      { name: "collateral", type: "address" },
      { name: "closeTime", type: "uint64" },
      { name: "resolveTime", type: "uint64" },
      { name: "disputeWindow", type: "uint64" },
      { name: "attestor", type: "address" },
      { name: "bond", type: "uint256" },
      {
        name: "source",
        type: "tuple",
        components: [
          { name: "kind", type: "uint8" },
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "twapWindow", type: "uint32" },
          { name: "comparator", type: "uint8" },
          { name: "threshold", type: "uint256" },
          { name: "feedRef", type: "bytes32" },
        ],
      },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const DECIMALS_ABI = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;

// The chain prediction markets are created on. Arb Sepolia: the deployed market
// is owned by the operator key we hold, so the owner path works end-to-end.
const MARKET_CHAIN = arbitrumSepolia;

function rpcUrl(): string {
  return (
    process.env.NEXT_PUBLIC_ARB_SEPOLIA_RPC_URL ||
    process.env.ARB_SEPOLIA_RPC_URL ||
    MARKET_CHAIN.rpcUrls.default.http[0]
  );
}

function predictionMarket(): `0x${string}` | "" {
  return (process.env.NEXT_PUBLIC_ARB_SEPOLIA_PREDICTION_MARKET as `0x${string}`) || "";
}

function collateralAddress(code: string): `0x${string}` | "" {
  const bare = code.replace(/^c/i, "").toUpperCase();
  const map: Record<string, string | undefined> = {
    NGN: process.env.NEXT_PUBLIC_ARB_TOKEN_NGN,
    GHS: process.env.NEXT_PUBLIC_ARB_TOKEN_GHS,
    KES: process.env.NEXT_PUBLIC_ARB_TOKEN_KES,
    USD: process.env.NEXT_PUBLIC_ARB_TOKEN_USD,
  };
  return (map[bare] as `0x${string}`) || "";
}

function ownerKey(): `0x${string}` | null {
  const k = process.env.MARKET_OWNER_PK || process.env.SETTLE_OPERATOR_PK;
  if (!k) return null;
  return (k.startsWith("0x") ? k : `0x${k}`) as `0x${string}`;
}

/** Can the server create binary markets on-chain right now? */
export function marketsChainReady(collateralCode = "cNGN"): boolean {
  return Boolean(ownerKey() && predictionMarket() && collateralAddress(collateralCode));
}

/** Block-explorer tx URL for the markets chain. */
export function marketTxUrl(tx: string): string {
  const base = MARKET_CHAIN.blockExplorers?.default.url ?? "https://sepolia.arbiscan.io";
  return `${base}/tx/${tx}`;
}

export const MARKET_CHAIN_KEY = "arbitrum-sepolia";
export const MARKET_VENUE = "evm" as const;

type CreateArgs = {
  question: string;
  /** collateral stablecoin symbol, e.g. "cNGN". */
  collateral: string;
  closeTime?: number; // unix secs; default now + 7d
  resolveTime?: number; // unix secs; default close + 7d
  disputeWindowSecs?: number; // default 1d
};

/** Create a binary market on-chain, signed by the owner key. Returns id + tx. */
export async function evmCreateMarketOwner(a: CreateArgs): Promise<{
  id: number;
  tx: string;
  txUrl: string;
  chainKey: string;
  venue: "evm";
  collateralToken: string;
}> {
  const pk = ownerKey();
  const pm = predictionMarket();
  const collateral = collateralAddress(a.collateral);
  if (!pk) throw new Error("owner key (MARKET_OWNER_PK / SETTLE_OPERATOR_PK) not configured");
  if (!pm) throw new Error("prediction market not deployed on the markets chain");
  if (!collateral) throw new Error(`no collateral token for ${a.collateral} on the markets chain`);

  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ chain: MARKET_CHAIN, transport: http(rpcUrl()) });

  let decimals = 18;
  try {
    decimals = Number(
      await publicClient.readContract({ address: collateral, abi: DECIMALS_ABI, functionName: "decimals" }),
    );
  } catch {
    /* default 18 */
  }

  const now = Math.floor(Date.now() / 1000);
  const closeTime = BigInt(a.closeTime && a.closeTime > now ? a.closeTime : now + 7 * 86400);
  const resolveTime = BigInt(
    a.resolveTime && a.resolveTime >= Number(closeTime) ? a.resolveTime : Number(closeTime) + 7 * 86400,
  );
  const disputeWindow = BigInt(a.disputeWindowSecs ?? 86400);
  const bond = parseUnits("50", decimals); // attested markets require bond > 0

  // Attested community market: no oracle feed, resolved by the bonded attestor
  // (the owner) inside a dispute window.
  const source = {
    kind: 1, // Attested
    tokenIn: ZERO,
    tokenOut: ZERO,
    twapWindow: 0,
    comparator: 0,
    threshold: 0n,
    feedRef: ZERO_BYTES32,
  } as const;

  const args = [
    a.question,
    collateral,
    closeTime,
    resolveTime,
    disputeWindow,
    account.address, // attestor = owner
    bond,
    source,
  ] as const;

  const { request, result } = await publicClient.simulateContract({
    account,
    address: pm,
    abi: MARKET_ABI,
    functionName: "createMarket",
    args,
  });

  const wallet = createWalletClient({ account, chain: MARKET_CHAIN, transport: http(rpcUrl()) });
  const tx = await wallet.writeContract(request);
  const id = Number(result);
  return {
    id,
    tx,
    txUrl: marketTxUrl(tx),
    chainKey: MARKET_CHAIN_KEY,
    venue: MARKET_VENUE,
    collateralToken: collateral,
  };
}
