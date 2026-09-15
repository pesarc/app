#!/usr/bin/env node
// Seeds opposing liquidity on Celo so the settlement agent always has flow to
// match against in a demo. Places one standing intent per corridor going the
// OPPOSITE way to the agent's typical requests (GHS->NGN, KES->GHS, NGN->KES),
// priced generously so any reasonable agent request clears.
//
//   node scripts/celo-seed.mjs
//
// Reads .env for CELO_AGENT_PK + NEXT_PUBLIC_CELO_* addresses.

import { readFileSync } from "node:fs";
import {
  createWalletClient, createPublicClient, http, parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celoSepolia } from "viem/chains";

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const M = process.env.NEXT_PUBLIC_CELO_INTENT_MATCHER;
const NGN = process.env.NEXT_PUBLIC_CELO_TOKEN_NGN;
const GHS = process.env.NEXT_PUBLIC_CELO_TOKEN_GHS;
const KES = process.env.NEXT_PUBLIC_CELO_TOKEN_KES;
const pk = process.env.CELO_AGENT_PK;
if (!M || !NGN || !GHS || !KES || !pk) {
  console.error("Missing CELO_AGENT_PK or NEXT_PUBLIC_CELO_* addresses in .env");
  process.exit(1);
}

const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
const transport = http(process.env.NEXT_PUBLIC_CELO_RPC_URL || celoSepolia.rpcUrls.default.http[0]);
const pub = createPublicClient({ chain: celoSepolia, transport });
const wallet = createWalletClient({ account, chain: celoSepolia, transport });

const erc20 = [{ type: "function", name: "approve", stateMutability: "nonpayable",
  inputs: [{ name: "s", type: "address" }, { name: "a", type: "uint256" }], outputs: [{ type: "bool" }] }];
const matcherAbi = [{ type: "function", name: "submitIntent", stateMutability: "nonpayable",
  inputs: [
    { name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" },
    { name: "amountIn", type: "uint128" }, { name: "minAmountOut", type: "uint128" },
    { name: "recipient", type: "address" }, { name: "expiry", type: "uint64" },
    { name: "reference_", type: "bytes32" }],
  outputs: [{ name: "id", type: "uint256" }] }];

// Opposing standing liquidity, priced loosely (minOut = 1 wei) so it always matches.
const legs = [
  { from: GHS, to: NGN, amt: 500_000, label: "GHS->NGN" },
  { from: KES, to: GHS, amt: 5_000_000, label: "KES->GHS" },
  { from: NGN, to: KES, amt: 5_000_000, label: "NGN->KES" },
];

const expiry = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 3600);
const ref = "0x" + "00".repeat(32);

for (const leg of legs) {
  const amountIn = parseUnits(String(leg.amt), 18);
  const a = await wallet.writeContract({ address: leg.from, abi: erc20, functionName: "approve", args: [M, amountIn] });
  await pub.waitForTransactionReceipt({ hash: a });
  const tx = await wallet.writeContract({
    address: M, abi: matcherAbi, functionName: "submitIntent",
    args: [leg.from, leg.to, amountIn, 1n, account.address, expiry, ref],
  });
  await pub.waitForTransactionReceipt({ hash: tx });
  console.log(`seeded ${leg.label}: ${leg.amt} — ${tx}`);
}
console.log("liquidity seeded; the agent now has opposing flow to match against.");
