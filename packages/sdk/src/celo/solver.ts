// The on-chain half of the settlement agent on Celo: submit an intent from
// the agent key, then scan and settle everything that clears (2-party or ring)
// — reusing the chain-agnostic matching logic from the Arbitrum build.

import { createWalletClient, encodeFunctionData, http, parseUnits, type Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CELO_CHAIN, celoPublicClient, celoRpcUrl, CELO } from "./config";
import { intentMatcherAbi } from "@pesarc/abi";
import { findPlans, type Intent } from "@pesarc/sdk/solver/matching";
import { withTag } from "./attribution";

const matcher = () => CELO.intentMatcher as `0x${string}`;

function agentAccount() {
  const pk = process.env.CELO_AGENT_PK;
  if (!pk) throw new Error("CELO_AGENT_PK not configured");
  return privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`);
}

function agentWallet() {
  return createWalletClient({
    account: agentAccount(),
    chain: CELO_CHAIN,
    transport: http(celoRpcUrl()),
  });
}

/** The agent's address (also the demo maker/solver). */
export function agentAddress(): `0x${string}` {
  return agentAccount().address;
}

/**
 * Sends a contract call with the hackathon attribution tag appended to its
 * calldata (ERC-8021), so the transaction is counted on the leaderboards. viem
 * has no data-suffix option, so we encode + append + send raw ourselves.
 */
async function sendTagged(
  wallet: ReturnType<typeof agentWallet>,
  client: ReturnType<typeof celoPublicClient>,
  address: `0x${string}`,
  abi: Abi,
  functionName: string,
  args: readonly unknown[],
): Promise<`0x${string}`> {
  const data = withTag(encodeFunctionData({ abi, functionName, args }));
  const hash = await wallet.sendTransaction({ to: address, data });
  await client.waitForTransactionReceipt({ hash });
  return hash;
}

/** Approves the matcher and submits an intent from the agent key. */
export async function submitIntent(params: {
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: number;
  minAmountOut: number;
  recipient: `0x${string}`;
  ref: string;
}): Promise<`0x${string}`> {
  const client = celoPublicClient();
  const wallet = agentWallet();
  const amountIn = parseUnits(params.amountIn.toFixed(6), 18);
  const minAmountOut = parseUnits(params.minAmountOut.toFixed(6), 18);
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 24 * 3600);

  const erc20 = [
    {
      type: "function",
      name: "approve",
      stateMutability: "nonpayable",
      inputs: [
        { name: "spender", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      outputs: [{ name: "", type: "bool" }],
    },
  ] as const;

  await sendTagged(wallet, client, params.tokenIn, erc20 as unknown as Abi, "approve", [
    matcher(),
    amountIn,
  ]);

  const refBytes = `0x${Buffer.from(params.ref.slice(0, 32))
    .toString("hex")
    .padEnd(64, "0")
    .slice(0, 64)}` as `0x${string}`;

  return sendTagged(wallet, client, matcher(), intentMatcherAbi as unknown as Abi, "submitIntent", [
    params.tokenIn,
    params.tokenOut,
    amountIn,
    minAmountOut,
    params.recipient,
    expiry,
    refBytes,
  ]);
}

async function loadIntents(): Promise<Intent[]> {
  const client = celoPublicClient();
  const count = (await client.readContract({
    address: matcher(),
    abi: intentMatcherAbi,
    functionName: "intentCount",
  })) as bigint;
  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
  const rows = await Promise.all(
    ids.map(
      (id) =>
        client.readContract({
          address: matcher(),
          abi: intentMatcherAbi,
          functionName: "intents",
          args: [id],
        }) as Promise<
          readonly [string, string, string, string, bigint, bigint, bigint, bigint, boolean]
        >,
    ),
  );
  return rows.map((r, i) => ({
    id: ids[i],
    tokenIn: r[2],
    tokenOut: r[3],
    amountIn: r[4],
    minAmountOut: r[5],
    remainingIn: r[6],
    expiry: Number(r[7]),
    active: r[8],
  }));
}

export type SettleOutcome = {
  settled: { kind: string; ids: string[]; tx: string }[];
  openIntents: number;
};

/** The autonomous settlement pass: match + settle everything that clears. */
export async function runCeloSolver(): Promise<SettleOutcome> {
  const client = celoPublicClient();
  const wallet = agentWallet();
  const account = agentAccount();

  const intents = await loadIntents();
  const now = Math.floor(Date.now() / 1000);
  const plans = findPlans(intents, now);
  const settled: SettleOutcome["settled"] = [];

  for (const p of plans) {
    const fn = p.size === 2 ? "matchIntents" : "matchRing";
    const args =
      p.size === 2
        ? ([p.ids[0], p.ids[1], p.fills[0], p.fills[1]] as const)
        : ([p.ids, p.fills] as const);
    try {
      await client.simulateContract({
        address: matcher(),
        abi: intentMatcherAbi,
        functionName: fn,
        args: args as never,
        account,
      });
      // Tag the settlement so it counts on the leaderboard (ERC-8021).
      const tx = await sendTagged(
        wallet,
        client,
        matcher(),
        intentMatcherAbi as unknown as Abi,
        fn,
        args as readonly unknown[],
      );
      settled.push({ kind: p.size === 2 ? "pair" : `ring-${p.size}`, ids: p.ids.map(String), tx });
    } catch {
      /* stale plan — skip */
    }
  }

  return {
    settled,
    openIntents: intents.filter((i) => i.active && i.expiry > now).length,
  };
}
