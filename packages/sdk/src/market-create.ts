// On-chain prediction-market creation (owner path). `createMarket` on
// PredictionMarket.sol is onlyOwner, so a community proposal is created on the
// user's behalf by the protocol owner key (server-side). Binary markets only —
// the contract is Yes/No; multi-outcome stays store-backed.
//
// Chain-generic: it targets whichever EVM chain the request names (from the
// registry), defaulting to the active chain. Activated by MARKET_OWNER_PK (falls
// back to SETTLE_OPERATOR_PK). Until a key is present the propose route falls
// back to the off-chain store.

import { createWalletClient, createPublicClient, http, parseUnits, zeroAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { activeChain, chainByKey, type EvmChainConfig } from "./chain/registry";

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
] as const;

const DECIMALS_ABI = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;

function resolveChain(chainKey?: string): EvmChainConfig {
  return (chainKey && chainByKey(chainKey)) || activeChain();
}

function collateralAddress(chain: EvmChainConfig, code: string): `0x${string}` | "" {
  const bare = code.replace(/^c/i, "").toUpperCase() as "NGN" | "GHS" | "KES" | "USD";
  return (chain.tokens[bare] as `0x${string}`) || "";
}

function ownerKey(): `0x${string}` | null {
  const k = process.env.MARKET_OWNER_PK || process.env.SETTLE_OPERATOR_PK;
  if (!k) return null;
  return (k.startsWith("0x") ? k : `0x${k}`) as `0x${string}`;
}

function txUrl(chain: EvmChainConfig, tx: string): string {
  const base = chain.chain.blockExplorers?.default.url ?? "";
  return base ? `${base}/tx/${tx}` : tx;
}

/** Can the server create binary markets on-chain on the given chain right now? */
export function marketsChainReady(collateralCode = "cNGN", chainKey?: string): boolean {
  const chain = resolveChain(chainKey);
  return Boolean(ownerKey() && chain.predictionMarket && collateralAddress(chain, collateralCode));
}

type CreateArgs = {
  question: string;
  collateral: string; // e.g. "cNGN"
  chainKey?: string; // target EVM chain (defaults to active)
  closeTime?: number;
  resolveTime?: number;
  disputeWindowSecs?: number;
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
  const chain = resolveChain(a.chainKey);
  const pm = chain.predictionMarket;
  const collateral = collateralAddress(chain, a.collateral);
  if (!pk) throw new Error("owner key (MARKET_OWNER_PK / SETTLE_OPERATOR_PK) not configured");
  if (!pm) throw new Error(`prediction market not deployed on ${chain.key}`);
  if (!collateral) throw new Error(`no collateral token for ${a.collateral} on ${chain.key}`);

  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ chain: chain.chain, transport: http(chain.rpcUrl) });

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

  const wallet = createWalletClient({ account, chain: chain.chain, transport: http(chain.rpcUrl) });
  const tx = await wallet.writeContract(request);
  return {
    id: Number(result),
    tx,
    txUrl: txUrl(chain, tx),
    chainKey: chain.key,
    venue: "evm",
    collateralToken: collateral,
  };
}
