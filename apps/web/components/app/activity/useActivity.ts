"use client";

// One merged activity stream: real on-chain transfers across every chain the
// wallet holds tokens on, plus fiat bank payouts. Newest first. Used by the home
// activity feed (recent + See all) and the dedicated /history page.

import { useEffect, useState } from "react";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { fetchOnchainActivity } from "@pesarc/sdk/chain/history";

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
      fetchOnchainActivity(smart.address as `0x${string}`, 50).catch(() => []),
      fetch("/api/payouts")
        .then((r) => r.json())
        .then((j) => (j?.ok ? (j.payouts as PayoutRow[]) : []))
        .catch(() => []),
    ])
      .then(([onchain, payouts]) => {
        if (!active) return;
        const chainItems: FeedItem[] = onchain.map((a) => ({
          id: a.id,
          source: "onchain",
          kind: a.kind,
          symbol: a.symbol,
          amount: a.amount,
          counterparty: a.counterparty,
          timestamp: a.timestamp,
          chainKey: a.chainKey,
          chainLabel: a.chainLabel,
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
        const merged = [...chainItems, ...bankItems].sort(
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
