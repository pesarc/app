// The agent's on-chain spend budget, read from AgentSessionKeys. Makes the
// "bounded authority" visible in the UI: the agent can only spend up to the cap
// the user granted, enforced on-chain. Fails soft to a mock so the demo never
// breaks (house live-vs-mock rule).

import { formatUnits } from "viem";
import { celoPublicClient, CELO } from "./celo/config";
import { agentSessionKeysAbi } from "@pesarc/abi";

export type AgentBudget = {
  cap: number; // granted spend cap (whole token units)
  remaining: number; // remaining today
  token: string; // collateral symbol
  live: boolean; // true when read from chain
};

const MOCK: AgentBudget = { cap: 50_000, remaining: 50_000, token: "cNGN", live: false };
const DECIMALS = 18;

export async function fetchAgentBudget(key?: `0x${string}`): Promise<AgentBudget> {
  const addr = CELO.agentSessionKeys;
  if (!addr || !key) return MOCK;
  try {
    const client = celoPublicClient();
    const [rem, session] = await Promise.all([
      client.readContract({
        address: addr,
        abi: agentSessionKeysAbi,
        functionName: "remaining",
        args: [key],
      }),
      client.readContract({
        address: addr,
        abi: agentSessionKeysAbi,
        functionName: "sessions",
        args: [key],
      }),
    ]);
    // sessions(key) → [token, cap, spent, expiry, active]
    const cap = Number(formatUnits(session[1], DECIMALS));
    return {
      cap,
      remaining: Number(formatUnits(rem as bigint, DECIMALS)),
      token: "cNGN",
      live: true,
    };
  } catch {
    return MOCK;
  }
}
