// Credit a successful top-up ON-CHAIN.
//
// The displayed balance is read live from each token's balanceOf (see
// chain/aggregateBalance.ts) — there is no off-chain ledger — so a deposit must
// land as REAL tokens in the user's wallet to show up. This helper does that
// for TESTNET: it mints the deposit currency's open-mint TestStable to the
// wallet via the operator key, the exact mechanism the faucet already uses.
//
// MAINNET IS DELIBERATELY REFUSED HERE. On mainnet a top-up is backed by the
// NGN that actually arrived and must be the matching cNGN minted by the licensed
// issuer (see cngn.ts) against that settlement — not an operator mint. That path
// is the founder's to wire; this module never touches a mainnet chain, so Claude
// (testnet/sandbox only) can run the whole flow end-to-end safely.

import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  getAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { erc20Abi } from "@pesarc/abi";
import { balanceChains, chainByKey, type EvmChainConfig, type TokenSymbol } from "./chain/registry";

// Open-mint entry point on the TestStable tokens (operator-only on-chain).
const MINT_ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export type CreditResult = {
  ok: boolean;
  tx?: string;
  chainKey?: string;
  reason?: string;
};

function operatorKey(): `0x${string}` | null {
  const k = process.env.MARKET_OWNER_PK || process.env.SETTLE_OPERATOR_PK;
  if (!k) return null;
  return (k.startsWith("0x") ? k : `0x${k}`) as `0x${string}`;
}

/** A currency maps onto a token symbol 1:1 (cNGN tracks NGN, etc.). */
function tokenSymbol(currency: string): TokenSymbol | null {
  const c = currency.toUpperCase();
  return c === "NGN" || c === "KES" || c === "GHS" || c === "USD" ? (c as TokenSymbol) : null;
}

/** Pick the chain to credit on: the client's active chain if it is a testnet
 *  that carries this currency's token, else the first configured testnet that
 *  does. Never a mainnet chain. */
function chainFor(currency: TokenSymbol, preferredKey?: string): EvmChainConfig | null {
  if (preferredKey) {
    const c = chainByKey(preferredKey);
    if (c && c.testnet && c.tokens[currency]) return c;
  }
  return balanceChains().find((c) => c.testnet && Boolean(c.tokens[currency])) ?? null;
}

/**
 * Mint `amount` (major units) of the deposit currency's TestStable to `address`
 * on a testnet. Best-effort and fully guarded: any missing precondition returns
 * { ok:false, reason } rather than throwing, so the webhook still 200s.
 */
export async function creditTopUp(args: {
  address: string;
  amount: number;
  currency: string;
  chainKey?: string;
}): Promise<CreditResult> {
  const pk = operatorKey();
  if (!pk) return { ok: false, reason: "no operator key configured" };

  let to: `0x${string}`;
  try {
    to = getAddress(args.address);
  } catch {
    return { ok: false, reason: "invalid wallet address" };
  }
  if (!(args.amount > 0)) return { ok: false, reason: "non-positive amount" };

  const sym = tokenSymbol(args.currency);
  if (!sym) return { ok: false, reason: `unsupported currency ${args.currency}` };

  const chain = chainFor(sym, args.chainKey);
  if (!chain) return { ok: false, reason: `no testnet ${sym} token configured` };
  // Belt-and-braces: never mint on a mainnet chain from here.
  if (!chain.testnet) return { ok: false, reason: "refusing to mint on a mainnet chain" };

  const token = chain.tokens[sym] as `0x${string}`;
  try {
    const account = privateKeyToAccount(pk);
    const publicClient = createPublicClient({ chain: chain.chain, transport: http(chain.rpcUrl) });
    const wallet = createWalletClient({ account, chain: chain.chain, transport: http(chain.rpcUrl) });

    const decimals = await publicClient
      .readContract({ address: token, abi: erc20Abi, functionName: "decimals" })
      .then((d) => Number(d))
      .catch(() => 18);

    const tx = await wallet.writeContract({
      address: token,
      abi: MINT_ABI,
      functionName: "mint",
      args: [to, parseUnits(String(args.amount), decimals)],
    });
    return { ok: true, tx, chainKey: chain.key };
  } catch (e) {
    return { ok: false, reason: `mint failed: ${(e as Error).message.slice(0, 120)}` };
  }
}
