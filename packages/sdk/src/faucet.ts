// Testnet faucet — funds a user's wallet so they can try the app end-to-end.
// Mints the local-currency test stablecoins (open-mint TestStable) and drips a
// little gas, all paid by the operator key. Arb Sepolia only. Server-side.

import { createWalletClient, createPublicClient, http, parseUnits, parseEther } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

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

const CHAIN = arbitrumSepolia;
const GAS_DRIP = parseEther("0.001"); // enough for a few non-gasless txs
const GAS_MIN = parseEther("0.0005"); // only drip if the wallet is below this
const AMOUNT_UNITS = "500000"; // 500k of each stablecoin

function rpcUrl(): string {
  return (
    process.env.NEXT_PUBLIC_ARB_SEPOLIA_RPC_URL ||
    process.env.ARB_SEPOLIA_RPC_URL ||
    CHAIN.rpcUrls.default.http[0]
  );
}

function ownerKey(): `0x${string}` | null {
  const k = process.env.MARKET_OWNER_PK || process.env.SETTLE_OPERATOR_PK;
  if (!k) return null;
  return (k.startsWith("0x") ? k : `0x${k}`) as `0x${string}`;
}

function tokens(): { code: string; address: `0x${string}` }[] {
  return [
    ["cNGN", process.env.NEXT_PUBLIC_ARB_TOKEN_NGN],
    ["cGHS", process.env.NEXT_PUBLIC_ARB_TOKEN_GHS],
    ["cKES", process.env.NEXT_PUBLIC_ARB_TOKEN_KES],
  ]
    .filter(([, a]) => Boolean(a))
    .map(([code, a]) => ({ code: code as string, address: a as `0x${string}` }));
}

/** Is the faucet operable (key + at least one token configured)? */
export function faucetReady(): boolean {
  return Boolean(ownerKey()) && tokens().length > 0;
}

export type FaucetResult = {
  chain: string;
  minted: { code: string; amount: string; tx: string }[];
  gasDripTx?: string;
};

/** Fund `to` with test stablecoins (+ a gas drip if it's low). */
export async function faucetDrip(to: `0x${string}`): Promise<FaucetResult> {
  const pk = ownerKey();
  if (!pk) throw new Error("faucet not configured");
  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ chain: CHAIN, transport: http(rpcUrl()) });
  const wallet = createWalletClient({ account, chain: CHAIN, transport: http(rpcUrl()) });

  // Manage the nonce explicitly so the mints (+ gas drip) don't race on it.
  let nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });

  const minted: FaucetResult["minted"] = [];
  for (const t of tokens()) {
    const tx = await wallet.writeContract({
      address: t.address,
      abi: MINT_ABI,
      functionName: "mint",
      args: [to, parseUnits(AMOUNT_UNITS, 18)],
      nonce: nonce++,
    });
    minted.push({ code: t.code, amount: AMOUNT_UNITS, tx });
  }

  let gasDripTx: string | undefined;
  try {
    const bal = await publicClient.getBalance({ address: to });
    if (bal < GAS_MIN) {
      gasDripTx = await wallet.sendTransaction({ to, value: GAS_DRIP, nonce: nonce++ });
    }
  } catch {
    /* gas drip is best-effort */
  }

  return { chain: "arbitrum-sepolia", minted, gasDripTx };
}
