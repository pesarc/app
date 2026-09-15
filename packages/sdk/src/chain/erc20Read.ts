// Read-only ERC-20 helpers via the hub public client. Safe in client or server.
import { getPublicClient } from "./chains";
import { erc20Abi } from "@stablearc/abi";

export async function readBalance(
  token: `0x${string}`,
  owner: `0x${string}`
): Promise<bigint> {
  return getPublicClient().readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  }) as Promise<bigint>;
}

export async function readDecimals(token: `0x${string}`): Promise<number> {
  try {
    const d = await getPublicClient().readContract({
      address: token,
      abi: erc20Abi,
      functionName: "decimals",
    });
    return Number(d);
  } catch {
    return 18;
  }
}

export async function readSymbol(token: `0x${string}`): Promise<string> {
  try {
    return (await getPublicClient().readContract({
      address: token,
      abi: erc20Abi,
      functionName: "symbol",
    })) as string;
  } catch {
    return "TKN";
  }
}

export type Erc20Snapshot = {
  balance: bigint;
  decimals: number;
  symbol: string;
};

export async function readErc20(
  token: `0x${string}`,
  owner: `0x${string}`
): Promise<Erc20Snapshot> {
  const [balance, decimals, symbol] = await Promise.all([
    readBalance(token, owner),
    readDecimals(token),
    readSymbol(token),
  ]);
  return { balance, decimals, symbol };
}
