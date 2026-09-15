"use client";

// Recent-activity list. In live mode it shows the wallet's REAL on-chain
// transfer history (test USD + cNGN on the hub chain, tx links included);
// otherwise it renders the server-provided fallback rows (DB / sample data).

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ExternalLink } from "lucide-react";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { fetchOnchainActivity, type OnchainActivity } from "@pesarc/sdk/chain/history";
import { explorerTxUrl, chainLabel } from "@pesarc/sdk/chain/chains";
import { Card } from "@/components/app/ui";

export type FallbackItem = {
  id: string;
  kind: "sent" | "received";
  counterparty: string;
  amountLabel: string;
  when: string;
  flag: string;
};

function timeAgo(unixSeconds?: number): string {
  if (!unixSeconds) return "";
  const m = Math.floor((Date.now() / 1000 - unixSeconds) / 60);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "Yesterday" : `${d}d ago`;
}

export function ActivityFeed({ fallback }: { fallback: FallbackItem[] }) {
  const { mode, authenticated } = useWallet();
  const smart = useSmartWallet();
  const [onchain, setOnchain] = useState<OnchainActivity[] | null>(null);

  const live = mode === "live" && authenticated && Boolean(smart.address);

  useEffect(() => {
    if (!live || !smart.address) {
      setOnchain(null);
      return;
    }
    let active = true;
    fetchOnchainActivity(smart.address as `0x${string}`)
      .then((items) => active && setOnchain(items))
      .catch(() => active && setOnchain(null));
    return () => {
      active = false;
    };
  }, [live, smart.address]);

  if (live && onchain && onchain.length > 0) {
    return (
      <div className="space-y-2">
        <div className="text-[11px] text-muted mb-1">
          On-chain · {chainLabel()}
        </div>
        {onchain.map((a) => {
          const sent = a.kind === "sent";
          return (
            <a
              key={a.id}
              href={explorerTxUrl(a.txHash)}
              target="_blank"
              rel="noreferrer"
              className="block group"
            >
              <Card className="flex items-center gap-3 p-3.5 group-hover:border-emerald/40 transition">
                <span
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    sent ? "bg-emerald-50 text-emerald" : "bg-gold/15 text-gold"
                  }`}
                >
                  {sent ? (
                    <ArrowUpRight className="w-5 h-5" />
                  ) : (
                    <ArrowDownLeft className="w-5 h-5" />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-deepink truncate">
                    {sent ? "Sent to" : "Received from"} {a.counterparty}
                  </div>
                  <div className="text-xs text-muted flex items-center gap-1">
                    {timeAgo(a.timestamp)}
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </div>
                </div>
                <div
                  className={`font-semibold numerals ${
                    sent ? "text-deepink" : "text-success"
                  }`}
                >
                  {sent ? "−" : "+"}
                  {a.amount.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{" "}
                  <span className="text-xs font-medium opacity-70">
                    {a.symbol}
                  </span>
                </div>
              </Card>
            </a>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {fallback.map((a) => {
        const sent = a.kind === "sent";
        return (
          <Card key={a.id} className="flex items-center gap-3 p-3.5">
            <span
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                sent ? "bg-emerald-50 text-emerald" : "bg-gold/15 text-gold"
              }`}
            >
              {sent ? (
                <ArrowUpRight className="w-5 h-5" />
              ) : (
                <ArrowDownLeft className="w-5 h-5" />
              )}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-deepink truncate">
                {sent ? "Sent to" : "Received from"} {a.counterparty}
              </div>
              <div className="text-xs text-muted">
                {a.flag} {a.when}
              </div>
            </div>
            <div
              className={`font-semibold numerals ${
                sent ? "text-deepink" : "text-success"
              }`}
            >
              {sent ? "−" : "+"}
              {a.amountLabel}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
