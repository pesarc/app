// Solana (SVM) stablecoin balances for a wallet, via plain JSON-RPC so we don't
// pull @solana/web3.js into the balance path. Reads the SPL token accounts the
// owner holds and keeps the ones whose mint is a known registry stablecoin on the
// given network (devnet for testing). Fails soft: any error -> [].

import { stablecoinsOnChain } from "../chain/stablecoin-registry";
import { midMarketRate, type CurrencyCode } from "../money";

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

/** Default devnet RPC; override with NEXT_PUBLIC_SVM_RPC_URL. */
function svmRpc(network: "mainnet" | "testnet"): string {
  return (
    process.env.NEXT_PUBLIC_SVM_RPC_URL ||
    (network === "mainnet" ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com")
  );
}

/** mint (base58) -> { symbol, fiat } for the registry's Solana stablecoins. */
function knownMints(network: "mainnet" | "testnet"): Record<string, { symbol: string; fiat: CurrencyCode }> {
  const out: Record<string, { symbol: string; fiat: CurrencyCode }> = {};
  for (const s of stablecoinsOnChain("solana", network)) {
    if (!s.address.startsWith("0x")) out[s.address] = { symbol: s.symbol, fiat: s.meta.fiat };
  }
  return out;
}

export type SvmHolding = {
  chainKey: string;
  chainLabel: string;
  fiat: CurrencyCode;
  symbol: string;
  amount: number;
  valueInDenom: number;
};

/** Real SPL stablecoin holdings for `owner` on Solana, summed into `denom`. */
export async function fetchSvmBalances(
  owner: string,
  denom: CurrencyCode,
  network: "mainnet" | "testnet" = "testnet",
): Promise<SvmHolding[]> {
  const known = knownMints(network);
  if (!owner || Object.keys(known).length === 0) return [];
  try {
    const res = await fetch(svmRpc(network), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [owner, { programId: TOKEN_PROGRAM }, { encoding: "jsonParsed" }],
      }),
    });
    const j = (await res.json()) as {
      result?: { value?: { account?: { data?: { parsed?: { info?: { mint?: string; tokenAmount?: { uiAmount?: number } } } } } }[] };
    };
    const accounts = j.result?.value ?? [];
    const label = network === "mainnet" ? "Solana" : "Solana Devnet";
    const out: SvmHolding[] = [];
    for (const a of accounts) {
      const info = a.account?.data?.parsed?.info;
      const mint = info?.mint;
      const amount = info?.tokenAmount?.uiAmount ?? 0;
      const meta = mint ? known[mint] : undefined;
      if (!meta || amount <= 0) continue;
      const valueInDenom = meta.fiat === denom ? amount : amount * midMarketRate(meta.fiat, denom);
      out.push({
        chainKey: `solana-${network}`,
        chainLabel: label,
        fiat: meta.fiat,
        symbol: meta.symbol,
        amount,
        valueInDenom,
      });
    }
    return out;
  } catch {
    return [];
  }
}
