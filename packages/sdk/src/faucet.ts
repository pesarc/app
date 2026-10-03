// Testnet faucet — funds a user's wallet so they can try the app end-to-end.
// Mints ~1 USD of each local-currency test stablecoin (open-mint TestStable) and
// drips a little gas, on EVERY testnet where our tokens live (Arbitrum Sepolia,
// Base Sepolia, Arc Testnet). Paid by the operator key. Server-side.

import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  parseEther,
  defineChain,
  type Chain,
} from "viem";
import { arbitrumSepolia, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { erc20Abi } from "@pesarc/abi";
import { midMarketRate, type CurrencyCode } from "./money";

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

const GAS_DRIP = parseEther("0.001"); // enough for a few non-gasless txs
const GAS_MIN = parseEther("0.0005"); // only drip if the wallet is below this

// Arc testnet: fund REAL native USDC (the 0x3600 predeploy, 6 decimals) so a
// gasless "send USDC" has something to move. Sent as an ERC-20 transfer (clean
// 6-dec) rather than a native value send, because Arc's native balance scaling
// differs from the 18-dec parseEther the gas drip assumes.
const ARC_USDC = "0x3600000000000000000000000000000000000000" as `0x${string}`;
const ARC_USDC_DRIP = parseUnits("5", 6); // 5 USDC — enough to try a few sends
const ARC_USDC_MIN = parseUnits("2", 6); // only top up when below 2 USDC

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.io"] },
  },
});

type FaucetToken = { code: string; currency: CurrencyCode; env: string };
type FaucetChain = {
  key: string;
  chain: Chain;
  rpcEnv: string;
  explorerTx: (h: string) => string;
  tokens: FaucetToken[];
};

// Every testnet where our open-mint TestStable tokens are deployed.
const CHAINS: FaucetChain[] = [
  {
    key: "arbitrum-sepolia",
    chain: arbitrumSepolia,
    rpcEnv: "NEXT_PUBLIC_ARB_SEPOLIA_RPC_URL",
    explorerTx: (h) => `https://sepolia.arbiscan.io/tx/${h}`,
    tokens: [
      { code: "cNGN", currency: "NGN", env: "NEXT_PUBLIC_ARB_TOKEN_NGN" },
      { code: "cGHS", currency: "GHS", env: "NEXT_PUBLIC_ARB_TOKEN_GHS" },
      { code: "cKES", currency: "KES", env: "NEXT_PUBLIC_ARB_TOKEN_KES" },
    ],
  },
  {
    key: "base-sepolia",
    chain: baseSepolia,
    rpcEnv: "NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL",
    explorerTx: (h) => `https://sepolia.basescan.org/tx/${h}`,
    tokens: [
      { code: "cNGN", currency: "NGN", env: "NEXT_PUBLIC_BASE_SEPOLIA_TOKEN_NGN" },
      { code: "cGHS", currency: "GHS", env: "NEXT_PUBLIC_BASE_SEPOLIA_TOKEN_GHS" },
      { code: "cKES", currency: "KES", env: "NEXT_PUBLIC_BASE_SEPOLIA_TOKEN_KES" },
    ],
  },
  {
    key: "arc-testnet",
    chain: arcTestnet,
    rpcEnv: "NEXT_PUBLIC_ARC_TESTNET_RPC_URL",
    explorerTx: (h) => `https://explorer.testnet.arc.io/tx/${h}`,
    tokens: [
      { code: "cNGN", currency: "NGN", env: "NEXT_PUBLIC_ARC_TESTNET_TOKEN_NGN" },
      { code: "cGHS", currency: "GHS", env: "NEXT_PUBLIC_ARC_TESTNET_TOKEN_GHS" },
      { code: "cKES", currency: "KES", env: "NEXT_PUBLIC_ARC_TESTNET_TOKEN_KES" },
    ],
  },
];

function ownerKey(): `0x${string}` | null {
  const k = process.env.MARKET_OWNER_PK || process.env.SETTLE_OPERATOR_PK;
  if (!k) return null;
  return (k.startsWith("0x") ? k : `0x${k}`) as `0x${string}`;
}

function rpcFor(c: FaucetChain): string {
  return process.env[c.rpcEnv] || c.chain.rpcUrls.default.http[0];
}

/** Configured tokens for a chain (those with an address in env). */
function configured(
  c: FaucetChain,
): { code: string; currency: CurrencyCode; address: `0x${string}` }[] {
  return c.tokens
    .map((t) => ({ code: t.code, currency: t.currency, address: process.env[t.env] as `0x${string}` | undefined }))
    .filter((t): t is { code: string; currency: CurrencyCode; address: `0x${string}` } => Boolean(t.address));
}

/** ~1 USD of a currency, in whole units (min 1). */
function oneUsdUnits(currency: CurrencyCode): string {
  const rate = midMarketRate("USD", currency); // 1 USD -> N units of `currency`
  return String(Math.max(1, Math.round(rate || 1)));
}

/** Is the faucet operable (key + at least one token configured on any chain)? */
export function faucetReady(): boolean {
  return Boolean(ownerKey()) && CHAINS.some((c) => configured(c).length > 0);
}

export type FaucetMint = { chain: string; code: string; amount: string; tx: string; explorer: string };
export type FaucetResult = { minted: FaucetMint[]; gasDripTxs: string[] };

/** Fund `to` with ~1 USD of each test stablecoin on every configured testnet
 *  (+ a gas drip per chain if it's low). Best-effort per chain: one chain failing
 *  (e.g. RPC down) doesn't abort the others. */
export async function faucetDrip(to: `0x${string}`): Promise<FaucetResult> {
  const pk = ownerKey();
  if (!pk) throw new Error("faucet not configured");
  const account = privateKeyToAccount(pk);

  const minted: FaucetMint[] = [];
  const gasDripTxs: string[] = [];

  for (const c of CHAINS) {
    const toks = configured(c);
    if (!toks.length) continue;
    try {
      const rpc = rpcFor(c);
      const publicClient = createPublicClient({ chain: c.chain, transport: http(rpc) });
      const wallet = createWalletClient({ account, chain: c.chain, transport: http(rpc) });
      let nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });

      for (const t of toks) {
        const amount = oneUsdUnits(t.currency);
        try {
          const tx = await wallet.writeContract({
            address: t.address,
            abi: MINT_ABI,
            functionName: "mint",
            args: [to, parseUnits(amount, 18)],
            nonce: nonce++,
          });
          minted.push({ chain: c.key, code: t.code, amount, tx, explorer: c.explorerTx(tx) });
        } catch {
          /* one token failing shouldn't block the rest */
        }
      }

      try {
        const bal = await publicClient.getBalance({ address: to });
        if (bal < GAS_MIN) {
          const gasTx = await wallet.sendTransaction({ to, value: GAS_DRIP, nonce: nonce++ });
          gasDripTxs.push(gasTx);
        }
      } catch {
        /* gas drip is best-effort */
      }

      // Arc testnet only: top up REAL USDC (0x3600, 6-dec) so a gasless USDC send
      // has funds to move. Best-effort — if the operator holds no testnet USDC
      // this throws and is skipped (the user can fund from Arc's testnet faucet).
      if (c.key === "arc-testnet") {
        try {
          const have = (await publicClient.readContract({
            address: ARC_USDC,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [to],
          })) as bigint;
          if (have < ARC_USDC_MIN) {
            const usdcTx = await wallet.writeContract({
              address: ARC_USDC,
              abi: erc20Abi,
              functionName: "transfer",
              args: [to, ARC_USDC_DRIP],
              nonce: nonce++,
            });
            minted.push({ chain: c.key, code: "USDC", amount: "5", tx: usdcTx, explorer: c.explorerTx(usdcTx) });
          }
        } catch {
          /* operator may hold no Arc testnet USDC — best-effort */
        }
      }
    } catch {
      /* whole chain unreachable — skip it, keep the others */
    }
  }

  return { minted, gasDripTxs };
}
