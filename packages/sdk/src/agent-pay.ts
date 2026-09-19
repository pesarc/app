// Server-side agent spend via AgentSessionKeys — the "agent gasless" path.
//
// The user grants a bounded session (cap + expiry) once. The agent then settles
// on their behalf by calling AgentSessionKeys.pay(to, amount) with its OWN key
// (server-side), metered on-chain against the cap — the user never signs or pays
// per action. The contract enforces the cap (see AgentSessionKeys.sol +
// forge tests: pay meters, cap-exceeded reverts, execute can't bypass it).
//
// Requires the agent key (AGENT_PK / CELO_AGENT_PK) and, on the owner side, an
// ERC-20 approval to the AgentSessionKeys contract.

import { createWalletClient, encodeFunctionData, http, parseUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { agentSessionKeysAbi } from "@pesarc/abi";
import { activeChain, publicClientFor, explorerTxUrl } from "./chain/registry";
import { withTag } from "./celo/attribution";

export type AgentPayResult = { txHash: string; explorerUrl: string; remaining: number };

function agentKey(): Hex | null {
  const pk = process.env.CELO_AGENT_PK || process.env.AGENT_PK;
  if (!pk) return null;
  return (pk.startsWith("0x") ? pk : `0x${pk}`) as Hex;
}

/** True when a real agent spend can execute (key + deployed session keys). */
export function agentPayConfigured(): boolean {
  return Boolean(agentKey() && activeChain().agentSessionKeys);
}

/** Agent pays `amount` (whole token units) to `to`, metered on-chain by the
 *  session cap. Returns the tx + the new remaining allowance. */
export async function agentSessionPay(
  to: `0x${string}`,
  amount: number,
  decimals = 18,
): Promise<AgentPayResult> {
  const key = agentKey();
  const chain = activeChain();
  if (!key) throw new Error("agent key not configured (AGENT_PK)");
  if (!chain.agentSessionKeys) throw new Error("AgentSessionKeys not deployed on the active chain");

  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain: chain.chain, transport: http(chain.rpcUrl) });

  // ERC-8021 attribution. The hackathon leaderboards only count transactions
  // carrying the assigned tag, and the tag lives in the calldata — it cannot be
  // backfilled after the transaction is sent. viem's writeContract has no
  // data-suffix option, so encode the call, append the tag, and send it raw
  // (same shape as celo/solver.ts#sendTagged). Non-Celo chains send untagged:
  // the suffix is meaningless off Celo, and trailing calldata is ignored by the
  // ABI decoder anyway.
  const onCelo = chain.key === "celo" || chain.key === "celo-sepolia";
  const data = encodeFunctionData({
    abi: agentSessionKeysAbi,
    functionName: "pay",
    args: [to, parseUnits(String(amount), decimals)],
  });
  const txHash = await wallet.sendTransaction({
    to: chain.agentSessionKeys,
    data: onCelo ? withTag(data) : data,
  });

  // Read back the remaining allowance (the on-chain source of truth).
  let remaining = 0;
  try {
    const pub = publicClientFor(chain);
    const rem = (await pub.readContract({
      address: chain.agentSessionKeys,
      abi: agentSessionKeysAbi,
      functionName: "remaining",
      args: [account.address],
    })) as bigint;
    remaining = Number(rem) / 10 ** decimals;
  } catch {
    /* best-effort */
  }

  return { txHash, explorerUrl: explorerTxUrl(chain, txHash), remaining };
}
