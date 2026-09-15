// Read layer for the live SettlementNetting set (Business/Settle mode).
// All reads go through the hub public client — safe in client or server.

import { formatUnits } from "viem";
import { getPublicClient } from "./chains";
import { CONTRACTS } from "./contracts";
import { settlementNettingAbi } from "@stablearc/abi";

/** Demo netting set bootstrapped by DeploySettlementNetting.s.sol. */
export const NETTING_SET_ID = BigInt(
  process.env.NEXT_PUBLIC_ARB_NETTING_SET_ID || 1
);

export type MemberPosition = {
  address: `0x${string}`;
  /** Net position in settlement-token units (+ receives, − pays). */
  net: number;
  isOperator: boolean;
};

export type OpenObligation = {
  debtor: `0x${string}`;
  creditor: `0x${string}`;
  amount: number;
};

export type NettingSnapshot = {
  setId: bigint;
  token: `0x${string}`;
  operator: `0x${string}`;
  active: boolean;
  cycle: number;
  members: MemberPosition[];
  obligations: OpenObligation[];
  /** Gross obligations recorded this cycle (token units). */
  gross: number;
  /** What would actually move on-chain if settled now (token units). */
  netToMove: number;
};

export function nettingAvailable(): boolean {
  return Boolean(CONTRACTS.settlementNetting);
}

/** Fetches the full live state of the netting set. Null when unavailable. */
export async function fetchNettingSnapshot(): Promise<NettingSnapshot | null> {
  if (!nettingAvailable()) return null;
  const address = CONTRACTS.settlementNetting as `0x${string}`;
  const client = getPublicClient();
  const setId = NETTING_SET_ID;

  try {
    const [info, members, grossWei, netToMoveWei] = await Promise.all([
      client.readContract({
        address,
        abi: settlementNettingAbi,
        functionName: "setInfo",
        args: [setId],
      }),
      client.readContract({
        address,
        abi: settlementNettingAbi,
        functionName: "membersOf",
        args: [setId],
      }) as Promise<readonly `0x${string}`[]>,
      client.readContract({
        address,
        abi: settlementNettingAbi,
        functionName: "grossThisCycle",
        args: [setId],
      }) as Promise<bigint>,
      client.readContract({
        address,
        abi: settlementNettingAbi,
        functionName: "netToMove",
        args: [setId],
      }) as Promise<bigint>,
    ]);

    const [token, operator, active, cycle] = info as unknown as [
      `0x${string}`,
      `0x${string}`,
      boolean,
      bigint,
      bigint
    ];

    const positions = await Promise.all(
      members.map(
        (m) =>
          client.readContract({
            address,
            abi: settlementNettingAbi,
            functionName: "netPositionOf",
            args: [setId, m],
          }) as Promise<bigint>
      )
    );

    // Open obligations: read the debtor→creditor matrix for all member pairs
    // (bounded — MAX_MEMBERS is 32, demo sets are far smaller).
    const pairs: { debtor: `0x${string}`; creditor: `0x${string}` }[] = [];
    for (const d of members)
      for (const c of members) if (d !== c) pairs.push({ debtor: d, creditor: c });
    const amounts = await Promise.all(
      pairs.map(
        (p) =>
          client.readContract({
            address,
            abi: settlementNettingAbi,
            functionName: "owed",
            args: [setId, p.debtor, p.creditor],
          }) as Promise<bigint>
      )
    );
    const obligations: OpenObligation[] = pairs
      .map((p, i) => ({ ...p, amount: Number(formatUnits(amounts[i], 18)) }))
      .filter((o) => o.amount > 0);

    return {
      setId,
      token,
      operator,
      active,
      cycle: Number(cycle),
      members: members.map((m, i) => ({
        address: m,
        net: Number(formatUnits(positions[i], 18)),
        isOperator: m.toLowerCase() === operator.toLowerCase(),
      })),
      obligations,
      gross: Number(formatUnits(grossWei, 18)),
      netToMove: Number(formatUnits(netToMoveWei, 18)),
    };
  } catch {
    return null;
  }
}

export function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
