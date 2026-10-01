"use client";

// One merged activity stream: real on-chain transfers across every chain the
// wallet holds tokens on, plus fiat bank payouts. Newest first. Used by the home
// activity feed (recent + See all) and the dedicated /history page.

import { useEffect, useState } from "react";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { fetchOnchainActivity } from "@pesarc/sdk/chain/history";
import { explorerTxUrl } from "@pesarc/sdk/chain/chains";

export type FeedItem = {
  id: string;
  source: "onchain" | "bank";
  kind: "sent" | "received";
  symbol: string;
  amount: number;
  counterparty: string;
  timestamp?: number;
  chainKey?: string;
  chainLabel?: string;
  /** true = testnet chain, false = mainnet, undefined = not chain-tagged (bank). */
  testnet?: boolean;
  explorer?: string;
  statusLabel?: string;
};

type PayoutRow = {
  reference: string;
  beneficiary: string;
  amountNgn: number;
  status: string;
  createdAt: string;
};

type TransferRow = {
  id: string;
  direction: "sent" | "received";
  counterparty: string;
  sendAmount: number;
  sendCurrency: string;
  receiveAmount: number;
  receiveCurrency: string;
  reference: string;
  txHash?: string;
  createdAt: string;
};

export function useActivity(): { items: FeedItem[]; loading: boolean; live: boolean } {
  const { mode, authenticated } = useWallet();
  const smart = useSmartWallet();
  const live = mode === "live" && authenticated && Boolean(smart.address);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!live || !smart.address) {
      setItems([]);
      return;
    }
    let active = true;
    setLoading(true);
    Promise.all([
      // Authoritative on-chain record: every send we persisted (with tx hash).
      fetch("/api/transfers")
        .then((r) => r.json())
        .then((j) => (j?.ok ? (j.transfers as TransferRow[]) : []))
        .catch(() => []),
      // Live chain scan — best-effort, fills in anything not locally recorded
      // (e.g. inbound transfers). Often empty on testnet RPCs, hence the record above.
      fetchOnchainActivity(smart.address as `0x${string}`, 50).catch(() => []),
      fetch("/api/payouts")
        .then((r) => r.json())
        .then((j) => (j?.ok ? (j.payouts as PayoutRow[]) : []))
        .catch(() => []),
    ])
      .then(([transfers, onchain, payouts]) => {
        if (!active) return;
        // Bank payouts are the fiat rows; keep their references to drop the
        // duplicate transfer rows (every bank send is recorded in both tables).
        const payoutRefs = new Set((payouts ?? []).map((p) => p.reference));
        const recordItems: FeedItem[] = (transfers ?? [])
          .filter((t) => !payoutRefs.has(t.reference))
          .map((t) => {
            const sent = t.direction === "sent";
            return {
              id: `tx-${t.id}`,
              source: "onchain" as const,
              kind: t.direction,
              symbol: sent ? t.sendCurrency : t.receiveCurrency,
              amount: sent ? t.sendAmount : t.receiveAmount,
              counterparty: t.counterparty,
              timestamp: t.createdAt ? Math.floor(Date.parse(t.createdAt) / 1000) : undefined,
              explorer: t.txHash ? explorerTxUrl(t.txHash) : undefined,
            };
          });
        // Drop live-scan rows already covered by a recorded tx hash.
        const seenTx = (transfers ?? [])
          .map((t) => t.txHash?.toLowerCase())
          .filter(Boolean) as string[];
        const scanItems: FeedItem[] = onchain
          .filter((a) => {
            const hay = `${a.id} ${a.explorer ?? ""}`.toLowerCase();
            return !seenTx.some((h) => hay.includes(h));
          })
          .map((a) => ({
            id: a.id,
            source: "onchain",
            kind: a.kind,
            symbol: a.symbol,
            amount: a.amount,
            counterparty: a.counterparty,
            timestamp: a.timestamp,
            chainKey: a.chainKey,
            chainLabel: a.chainLabel,
            testnet: a.testnet,
            explorer: a.explorer,
          }));
        const bankItems: FeedItem[] = (payouts ?? []).map((p) => ({
          id: `payout-${p.reference}`,
          source: "bank",
          kind: "sent",
          symbol: "NGN",
          amount: p.amountNgn,
          counterparty: p.beneficiary,
          timestamp: p.createdAt ? Math.floor(Date.parse(p.createdAt) / 1000) : undefined,
          statusLabel: p.status,
        }));
        const merged = [...recordItems, ...scanItems, ...bankItems].sort(
          (a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0),
        );
        setItems(merged);
        setLoading(false);
      })
      .catch(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [live, smart.address]);

  return { items, loading, live };
}
