"use client";

// Recent-activity list. In live mode it shows the wallet's REAL on-chain transfer
// history (tx links included); otherwise the server-provided real transfer rows.
// No mock data: with nothing to show, it renders a friendly empty state. Each row
// leads with an icon for the activity type (send / receive / bank / bill / earn /
// swap / pay) and carries a small badge in the corner for the chain it settled on.

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Landmark,
  Zap,
  Sprout,
  Shuffle,
  QrCode,
  Receipt,
  ExternalLink,
} from "@/components/icons";
import type { IconType } from "@/components/icons";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { fetchOnchainActivity, type OnchainActivity } from "@pesarc/sdk/chain/history";
import { explorerTxUrl, chainLabel } from "@pesarc/sdk/chain/chains";

export type ActivityType = "send" | "receive" | "bank" | "bill" | "earn" | "swap" | "pay";

export type FallbackItem = {
  id: string;
  kind: "sent" | "received";
  counterparty: string;
  amountLabel: string;
  when: string;
  flag: string;
  /** What the activity is, for the leading icon. */
  type: ActivityType;
};

/** Icon + tint for each activity type. */
const TYPE_VISUAL: Record<ActivityType, { Icon: IconType; bg: string; fg: string }> = {
  send: { Icon: ArrowUpRight, bg: "#e8f1fb", fg: "#13426f" },
  receive: { Icon: ArrowDownLeft, bg: "#e2f6ee", fg: "#0f8a6b" },
  bank: { Icon: Landmark, bg: "#eef1f5", fg: "#3a4b5c" },
  bill: { Icon: Zap, bg: "#fdf3e2", fg: "#a97b12" },
  earn: { Icon: Sprout, bg: "#e6f7ec", fg: "#12a86e" },
  swap: { Icon: Shuffle, bg: "#efeafe", fg: "#6b4ef0" },
  pay: { Icon: QrCode, bg: "#e8f1fb", fg: "#0254a5" },
};

const TYPE_LABEL: Record<ActivityType, string> = {
  send: "Sent",
  receive: "Received",
  bank: "Bank payout",
  bill: "Bill",
  earn: "Earn",
  swap: "Swap",
  pay: "Payment",
};

/** A short, friendly network name ("Arbitrum Sepolia" -> "Arbitrum"). */
function shortNetwork(label: string): string {
  return label.replace(/\s*(mainnet|testnet|sepolia|devnet)\s*/gi, "").trim() || label;
}

/** A chain's badge colour + 2-letter tag, from its label. Order matters. */
function chainVisual(label: string): { color: string; tag: string; name: string } {
  const l = label.toLowerCase();
  const name = shortNetwork(label);
  if (l.includes("arbitrum")) return { color: "#12AAFF", tag: "AR", name };
  if (l.includes("base")) return { color: "#0052FF", tag: "BS", name };
  if (l.includes("optimism") || /\bop\b/.test(l)) return { color: "#FF0420", tag: "OP", name };
  if (l.includes("polygon")) return { color: "#8247E5", tag: "PG", name };
  if (l.includes("celo")) return { color: "#EAB308", tag: "CE", name };
  if (l.includes("arc")) return { color: "#00C2A8", tag: "AC", name };
  if (l.includes("solana")) return { color: "#9945FF", tag: "SO", name };
  if (l.includes("ethereum") || l.includes("sepolia")) return { color: "#627EEA", tag: "ET", name };
  return { color: "#2e96ff", tag: (name.slice(0, 2) || "··").toUpperCase(), name };
}

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

/** Shared row chrome: type-icon tile with a chain badge in the corner. */
function Row({
  type,
  chain,
  title,
  sub,
  amount,
  positive,
}: {
  type: ActivityType;
  chain: { color: string; tag: string; name: string };
  title: string;
  sub: React.ReactNode;
  amount: React.ReactNode;
  positive: boolean;
}) {
  const v = TYPE_VISUAL[type];
  const Icon = v.Icon;
  return (
    <div className="flex items-center gap-3 bg-snow border border-fog rounded-[20px] px-4 py-3 shadow-card-flat">
      <div className="relative shrink-0">
        <div
          className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center"
          style={{ backgroundColor: v.bg, color: v.fg }}
        >
          <Icon className="w-[19px] h-[19px]" strokeWidth={2} />
        </div>
        <span
          className="absolute -right-1.5 -bottom-1.5 h-[18px] min-w-[18px] px-1 rounded-full flex items-center justify-center text-[9px] font-extrabold text-white ring-2 ring-snow"
          style={{ backgroundColor: chain.color }}
          title={`Settled on ${chain.name}`}
          aria-label={`Settled on ${chain.name}`}
        >
          {chain.tag}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-bold text-ink truncate">{title}</div>
        <div className="text-[12.5px] font-medium text-slate truncate">{sub}</div>
      </div>
      <div className={`text-right text-[15px] font-extrabold numerals ${positive ? "text-sky-deep" : "text-harbor"}`}>
        {amount}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[20px] border border-dashed border-fog bg-snow/60 px-6 py-10 text-center">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-sky-tint/60 text-sky-deep flex items-center justify-center mb-3">
        <Receipt className="w-6 h-6" strokeWidth={1.9} />
      </div>
      <div className="text-[15px] font-bold text-harbor">No activity yet</div>
      <p className="text-[13px] text-slate mt-1 max-w-[240px] mx-auto">
        Your sends, swaps, payments and payouts will show up here, each tagged with
        the chain it settled on.
      </p>
    </div>
  );
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

  const chain = chainVisual(chainLabel());

  if (live && onchain && onchain.length > 0) {
    return (
      <div className="space-y-2.5">
        {onchain.map((a) => {
          const sent = a.kind === "sent";
          return (
            <a key={a.id} href={explorerTxUrl(a.txHash)} target="_blank" rel="noreferrer" className="block">
              <Row
                type={sent ? "send" : "receive"}
                chain={chain}
                title={a.counterparty}
                positive={!sent}
                sub={
                  <span className="inline-flex items-center gap-1.5">
                    {sent ? "Sent" : "Received"} · {timeAgo(a.timestamp)} · {chain.name}
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

  if (fallback.length === 0) return <EmptyState />;

  return (
    <div className="space-y-2.5">
      {fallback.map((a) => {
        const sent = a.kind === "sent";
        return (
          <Row
            key={a.id}
            type={a.type}
            chain={chain}
            title={a.counterparty}
            positive={!sent}
            sub={`${TYPE_LABEL[a.type]} · ${a.when} · ${chain.name}`}
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
