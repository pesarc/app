// The web2 -> web3 bridge for the agent: a registry-driven settlement executor
// that works on ANY configured EVM chain (Arc, Celo, Base, …), not just Celo.
//
// The shared agent brain (sdk/agent/run.ts, used by in-app chat, WhatsApp, USSD
// and the API) forms an intent; this submits it from the chain's agent key and
// runs the solver against the same IntentMatcher the app reads. The matching
// logic is chain-agnostic; only the addresses, RPC and key come from the
// registry per chain. The ERC-8021 attribution tag is applied on Celo only
// (its hackathon leaderboard); every other chain sends plain calldata.

import {
  createWalletClient,
  encodeFunctionData,
  formatUnits,
  http,
  parseUnits,
  type Abi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { intentMatcherAbi, realizedRateOracleAbi } from "@pesarc/abi";
import { findPlans, type Intent } from "../solver/matching";
import { withTag } from "../celo/attribution";
import {
  explorerTxUrl,
  publicClientFor,
  type EvmChainConfig,
} from "./registry";

const FLAGS: Record<string, string> = { NGN: "🇳🇬", GHS: "🇬🇭", KES: "🇰🇪", USD: "💵" };

export type AgentToken = { code: string; address: `0x${string}`; flag: string };

/** Resolve a token the agent can move on this chain, by currency code. */
export function tokenByCode(chain: EvmChainConfig, code: string): AgentToken | undefined {
  const key = code.toUpperCase() as keyof typeof chain.tokens;
  const address = chain.tokens[key];
  if (!address) return undefined;
  return { code: key, address, flag: FLAGS[key] ?? "🌍" };
}

/** Env var name holding the server-side agent PRIVATE key for a chain. */
function agentPkEnv(chain: EvmChainConfig): string {
  return `${chain.key.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_AGENT_PK`;
}

/**
 * The agent's PRIVATE key for a chain. Convention: `<PREFIX>_AGENT_PK`
 * (e.g. `ARC_AGENT_PK`, `CELO_AGENT_PK`), falling back to a shared
 * `SETTLE_OPERATOR_PK` / `AGENT_PK`. Server-only (never NEXT_PUBLIC).
 */
export function evmAgentPk(chain: EvmChainConfig): `0x${string}` | null {
  const raw =
    process.env[agentPkEnv(chain)] ||
    process.env.SETTLE_OPERATOR_PK ||
    process.env.AGENT_PK ||
    "";
  if (!raw) return null;
  return (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
}

function agentAccount(chain: EvmChainConfig) {
  const pk = evmAgentPk(chain);
  if (!pk) {
    throw new Error(
      `agent key not configured for ${chain.key} (set ${agentPkEnv(chain)} or SETTLE_OPERATOR_PK)`,
    );
  }
  return privateKeyToAccount(pk);
}

/** The agent's on-chain address on this chain. */
export function evmAgentAddress(chain: EvmChainConfig): `0x${string}` {
  return agentAccount(chain).address;
}

function agentWallet(chain: EvmChainConfig) {
  return createWalletClient({
    account: agentAccount(chain),
    chain: chain.chain,
    transport: http(chain.rpcUrl),
  });
}

const isCelo = (c: EvmChainConfig) => c.key === "celo" || c.key === "celo-sepolia";

/** Can the agent transact on-chain on this chain right now? */
export function evmAgentReady(chain: EvmChainConfig): boolean {
  return (
    Boolean(chain.intentMatcher) &&
    Boolean(evmAgentPk(chain)) &&
    Object.keys(chain.tokens).length >= 2
  );
}

/** The realized rate from this chain's oracle (0 when unknown). */
export async function realizedRateOn(
  chain: EvmChainConfig,
  from: `0x${string}`,
  to: `0x${string}`,
): Promise<number> {
  if (!chain.realizedOracle) return 0;
  const client = publicClientFor(chain);
  try {
    const has = (await client.readContract({
      address: chain.realizedOracle,
      abi: realizedRateOracleAbi,
      functionName: "hasData",
      args: [from, to],
    })) as boolean;
    if (!has) return 0;
    const rate1e18 = (await client.readContract({
      address: chain.realizedOracle,
      abi: realizedRateOracleAbi,
      functionName: "latestRate1e18",
      args: [from, to],
    })) as bigint;
    return Number(formatUnits(rate1e18, 18));
  } catch {
    return 0;
  }
}

async function send(
  chain: EvmChainConfig,
  wallet: ReturnType<typeof agentWallet>,
  client: ReturnType<typeof publicClientFor>,
  address: `0x${string}`,
  abi: Abi,
  functionName: string,
  args: readonly unknown[],
): Promise<`0x${string}`> {
  let data = encodeFunctionData({ abi, functionName, args });
  if (isCelo(chain)) data = withTag(data); // ERC-8021 attribution, Celo only
  const hash = await wallet.sendTransaction({ to: address, data });
  await client.waitForTransactionReceipt({ hash });
  return hash;
}

const ERC20_APPROVE = [
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

/** Approve the matcher and submit an intent from the chain's agent key. */
export async function submitIntentOn(
  chain: EvmChainConfig,
  params: {
    tokenIn: `0x${string}`;
    tokenOut: `0x${string}`;
    amountIn: number;
    minAmountOut: number;
    recipient: `0x${string}`;
    ref: string;
  },
): Promise<`0x${string}`> {
  const matcher = chain.intentMatcher as `0x${string}`;
  const client = publicClientFor(chain);
  const wallet = agentWallet(chain);
  const amountIn = parseUnits(params.amountIn.toFixed(6), 18);
  const minAmountOut = parseUnits(params.minAmountOut.toFixed(6), 18);
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 24 * 3600);

  await send(chain, wallet, client, params.tokenIn, ERC20_APPROVE as unknown as Abi, "approve", [
    matcher,
    amountIn,
  ]);

  const refBytes = `0x${Buffer.from(params.ref.slice(0, 32))
    .toString("hex")
    .padEnd(64, "0")
    .slice(0, 64)}` as `0x${string}`;

  return send(chain, wallet, client, matcher, intentMatcherAbi as unknown as Abi, "submitIntent", [
    params.tokenIn,
    params.tokenOut,
    amountIn,
    minAmountOut,
    params.recipient,
    expiry,
    refBytes,
  ]);
}

async function loadIntents(chain: EvmChainConfig): Promise<Intent[]> {
  const matcher = chain.intentMatcher as `0x${string}`;
  const client = publicClientFor(chain);
  const count = (await client.readContract({
    address: matcher,
    abi: intentMatcherAbi,
    functionName: "intentCount",
  })) as bigint;
  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
  const rows = await Promise.all(
    ids.map(
      (id) =>
        client.readContract({
          address: matcher,
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

/** The autonomous settlement pass on a chain: match + settle everything that clears. */
export async function runEvmSolver(chain: EvmChainConfig): Promise<SettleOutcome> {
  const matcher = chain.intentMatcher as `0x${string}`;
  const client = publicClientFor(chain);
  const wallet = agentWallet(chain);
  const account = agentAccount(chain);

  const intents = await loadIntents(chain);
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
        address: matcher,
        abi: intentMatcherAbi,
        functionName: fn,
        args: args as never,
        account,
      });
      const tx = await send(
        chain,
        wallet,
        client,
        matcher,
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

export { explorerTxUrl };
