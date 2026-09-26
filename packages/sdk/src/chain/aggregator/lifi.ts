// Phase 2 — LI.FI aggregator. Any-token / any-chain routes across 60+ chains and
// 12+ bridges (incl. Solana), so EVM→Solana goes through LI.FI's tested infra
// instead of a hand-built Solana mint. The source tx runs on the user's EVM
// wallet; the destination leg is handled by the chosen bridge. (Algorand is NOT
// on LI.FI — it needs Wormhole Portal, tracked separately.)
//
// LI.FI's public API needs no key for basic quotes (rate-limited); set an
// integrator key later to raise limits.

const LIFI_API = "https://li.quest/v1";

/** LI.FI's chain id for Solana (not a normal EVM id). */
export const LIFI_SOLANA_CHAIN = 1151111081099710;

export type LifiQuoteInput = {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  /** Source amount in base units (USDC = 6 decimals). */
  fromAmount: string;
  fromAddress: string;
  toAddress: string;
};

export type LifiTxRequest = {
  to: `0x${string}`;
  data: `0x${string}`;
  value?: string;
  chainId?: number;
  gasLimit?: string;
  gasPrice?: string;
};

export type LifiQuote = {
  tool: string;
  toAmount: string;
  toAmountUSD?: string;
  durationSec: number;
  feeUSD: number;
  gasUSD: number;
  transactionRequest: LifiTxRequest;
};

export async function getLifiQuote(i: LifiQuoteInput): Promise<LifiQuote> {
  const qs = new URLSearchParams({
    fromChain: String(i.fromChain),
    toChain: String(i.toChain),
    fromToken: i.fromToken,
    toToken: i.toToken,
    fromAmount: i.fromAmount,
    fromAddress: i.fromAddress,
    toAddress: i.toAddress,
  });
  const res = await fetch(`${LIFI_API}/quote?${qs.toString()}`);
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`No route found (LI.FI ${res.status}) ${t.slice(0, 160)}`);
  }
  const d = (await res.json()) as {
    tool?: string;
    estimate?: {
      toAmount?: string;
      toAmountUSD?: string;
      executionDuration?: number;
      feeCosts?: { amountUSD?: string }[];
      gasCosts?: { amountUSD?: string }[];
    };
    transactionRequest?: LifiTxRequest;
  };
  const e = d.estimate ?? {};
  const feeUSD = (e.feeCosts ?? []).reduce((s, f) => s + Number(f.amountUSD || 0), 0);
  const gasUSD = (e.gasCosts ?? []).reduce((s, g) => s + Number(g.amountUSD || 0), 0);
  if (!d.transactionRequest) throw new Error("LI.FI returned no transaction to send.");
  return {
    tool: d.tool ?? "lifi",
    toAmount: e.toAmount ?? "0",
    toAmountUSD: e.toAmountUSD,
    durationSec: Number(e.executionDuration || 0),
    feeUSD,
    gasUSD,
    transactionRequest: d.transactionRequest,
  };
}

export type LifiStatus = {
  status: string; // NOT_FOUND | PENDING | DONE | FAILED
  substatus?: string;
  receivingTx?: string;
};

/** Poll a cross-chain transfer's status by its source tx hash. */
export async function getLifiStatus(
  txHash: string,
  fromChain?: number,
  toChain?: number,
): Promise<LifiStatus> {
  const qs = new URLSearchParams({ txHash });
  if (fromChain) qs.set("fromChain", String(fromChain));
  if (toChain) qs.set("toChain", String(toChain));
  const res = await fetch(`${LIFI_API}/status?${qs.toString()}`);
  if (!res.ok) return { status: "PENDING" };
  const d = (await res.json()) as {
    status?: string;
    substatus?: string;
    receiving?: { txHash?: string };
  };
  return { status: d.status ?? "PENDING", substatus: d.substatus, receivingTx: d.receiving?.txHash };
}
