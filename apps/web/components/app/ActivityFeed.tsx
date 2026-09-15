"use client";

// Recent-activity list. In live mode it shows the wallet's REAL on-chain
// transfer history (test USD + cNGN on the hub chain, tx links included);
// otherwise it renders the server-provided fallback rows (DB / sample data).

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { fetchOnchainActivity, type OnchainActivity } from "@pesarc/sdk/chain/history";
import { explorerTxUrl, chainLabel } from "@pesarc/sdk/chain/chains";
import { initials } from "@pesarc/sdk/account";

/** Shared row chrome — flat card, initials avatar with an optional flag badge. */
function Row({
  name,
  initialsColor,
  flag,
  sub,
  amount,
  positive,
}: {
  name: string;
  initialsColor: string;
  flag?: string;
  sub: React.ReactNode;
  amount: React.ReactNode;
  positive: boolean;
}) {
  return (
    <div className="flex items-center gap-3 bg-snow border border-fog rounded-[20px] px-4 py-3 shadow-card-flat">
      <div
        className="relative w-[42px] h-[42px] rounded-full flex items-center justify-center font-extrabold text-sm text-white shrink-0"
        style={{ backgroundColor: initialsColor }}
      >
        {initials(name)}
        {flag && <span className="absolute -right-1 -bottom-1 text-sm">{flag}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-bold text-ink truncate">{name}</div>
        <div className="text-[12.5px] font-medium text-slate truncate">{sub}</div>
      </div>
      <div className={`text-right text-[15px] font-extrabold numerals ${positive ? "text-sky-deep" : "text-harbor"}`}>
        {amount}
      </div>
    </div>
  );
}

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
      <div className="space-y-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-slate mb-1">
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
              className="block"
            >
              <Row
                name={a.counterparty}
                initialsColor={sent ? "#13426f" : "#0254a5"}
                positive={!sent}
                sub={
                  <span className="inline-flex items-center gap-1">
                    {sent ? "Sent" : "Received"} · {timeAgo(a.timestamp)}
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </span>
                }
                amount={
                  <>
                    {sent ? "−" : "+"}
                    {a.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                    <span className="text-xs font-semibold opacity-70">{a.symbol}</span>
                  </>
                }
              />
            </a>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {fallback.map((a) => {
        const sent = a.kind === "sent";
        return (
          <Row
            key={a.id}
            name={a.counterparty}
            initialsColor={sent ? "#13426f" : "#0254a5"}
            flag={a.flag}
            positive={!sent}
            sub={`${sent ? "Sent" : "Received"} · ${a.when}`}
            amount={
              <>
                {sent ? "−" : "+"}
                {a.amountLabel}
              </>
            }
          />
        );
      })}
    </div>
  );
}
