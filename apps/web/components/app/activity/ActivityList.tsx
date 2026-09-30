"use client";

// The activity list, shared by the home feed (recent 5 + See all) and the
// dedicated /history page (full, paginated). One clean Filter icon opens a
// popover to slice by type (on-chain / bank), chain and token. Each on-chain row
// carries the real chain it settled on as a corner badge.

import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Landmark,
  Receipt,
  ExternalLink,
  Filter,
  ChevronRight,
} from "@/components/icons";
import type { IconType } from "@/components/icons";
import { chainLogoUrl, chainLogoKey } from "@/lib/chainLogos";
import { useActivity, type FeedItem } from "./useActivity";

type TypeKey = "send" | "receive" | "bank";
const TYPE_VISUAL: Record<TypeKey, { Icon: IconType; bg: string; fg: string }> = {
  send: { Icon: ArrowUpRight, bg: "#e8f1fb", fg: "#13426f" },
  receive: { Icon: ArrowDownLeft, bg: "#e2f6ee", fg: "#0f8a6b" },
  bank: { Icon: Landmark, bg: "#eef1f5", fg: "#3a4b5c" },
};

const shortNetwork = (label: string) =>
  label.replace(/\s*(mainnet|testnet|sepolia|devnet)\s*/gi, "").trim() || label;

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

function ChainBadge({ label }: { label: string }) {
  const url = chainLogoUrl(chainLogoKey(label));
  const [broken, setBroken] = useState(false);
  const show = Boolean(url) && !broken;
  return (
    <span
      className="absolute -right-1.5 -bottom-1.5 h-[19px] w-[19px] rounded-full flex items-center justify-center overflow-hidden ring-2 ring-snow bg-white"
      title={`On ${shortNetwork(label)}`}
    >
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny corner brand logo
        <img src={url} alt="" width={15} height={15} style={{ objectFit: "contain" }} onError={() => setBroken(true)} />
      ) : null}
    </span>
  );
}

function Row({ item }: { item: FeedItem }) {
  const type: TypeKey = item.source === "bank" ? "bank" : item.kind === "sent" ? "send" : "receive";
  const v = TYPE_VISUAL[type];
  const Icon = v.Icon;
  const positive = item.kind === "received";
  const amount =
    item.source === "bank"
      ? `−₦${item.amount.toLocaleString()}`
      : `${item.kind === "sent" ? "−" : "+"}${item.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${item.symbol}`;
  const sub =
    item.source === "bank"
      ? `Bank payout · ${timeAgo(item.timestamp)}${item.statusLabel ? ` · ${item.statusLabel}` : ""}`
      : `${item.kind === "sent" ? "Sent" : "Received"} · ${timeAgo(item.timestamp)} · ${shortNetwork(item.chainLabel ?? "")}`;

  const body = (
    <div className="flex items-center gap-3 bg-snow border border-fog rounded-[20px] px-4 py-3 shadow-card-flat">
      <div className="relative shrink-0">
        <div className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center" style={{ backgroundColor: v.bg, color: v.fg }}>
          <Icon className="w-[19px] h-[19px]" strokeWidth={2} />
        </div>
        {item.source === "onchain" && item.chainLabel && <ChainBadge label={item.chainLabel} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-bold text-ink truncate">{item.counterparty}</div>
        <div className="text-[12.5px] font-medium text-slate truncate inline-flex items-center gap-1.5">
          {sub}
          {item.explorer && <ExternalLink className="w-3 h-3 opacity-60" />}
        </div>
      </div>
      <div className={`text-right text-[15px] font-extrabold numerals ${positive ? "text-sky-deep" : "text-harbor"}`}>
        {amount}
      </div>
    </div>
  );
  return item.explorer ? (
    <a href={item.explorer} target="_blank" rel="noreferrer" className="block">
      {body}
    </a>
  ) : (
    body
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
        Your sends, swaps, payments and payouts will show up here, each tagged with the chain it settled on.
      </p>
    </div>
  );
}

type Filters = { source: "all" | "onchain" | "bank"; chain: string; token: string };

function FilterMenu({
  chains,
  tokens,
  hasBank,
  value,
  onChange,
}: {
  chains: { key: string; label: string }[];
  tokens: string[];
  hasBank: boolean;
  value: Filters;
  onChange: (f: Filters) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const active = value.source !== "all" || value.chain !== "all" || value.token !== "all";
  const chip = (on: boolean) =>
    `px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
      on ? "bg-harbor text-white" : "bg-black/[0.05] text-slate hover:bg-black/[0.08]"
    }`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Filter activity"
        className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
          active ? "bg-sky-tint/60 text-sky-deep" : "bg-black/[0.04] text-slate hover:bg-black/[0.08]"
        }`}
      >
        <Filter className="w-[18px] h-[18px]" />
        {active && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-sky" />}
      </button>
      {open && (
        <div className="animate-dropdown absolute right-0 mt-2 z-30 w-64 rounded-2xl border border-fog bg-snow shadow-pop-sm p-3 space-y-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate mb-1.5">Show</div>
            <div className="flex flex-wrap gap-1.5">
              {(["all", "onchain", ...(hasBank ? (["bank"] as const) : [])] as const).map((s) => (
                <button key={s} className={chip(value.source === s)} onClick={() => onChange({ ...value, source: s })}>
                  {s === "all" ? "All" : s === "onchain" ? "On-chain" : "Bank"}
                </button>
              ))}
            </div>
          </div>
          {chains.length > 1 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate mb-1.5">Chain</div>
              <div className="flex flex-wrap gap-1.5">
                <button className={chip(value.chain === "all")} onClick={() => onChange({ ...value, chain: "all" })}>
                  All
                </button>
                {chains.map((c) => (
                  <button key={c.key} className={chip(value.chain === c.key)} onClick={() => onChange({ ...value, chain: c.key })}>
                    {shortNetwork(c.label)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {tokens.length > 1 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate mb-1.5">Token</div>
              <div className="flex flex-wrap gap-1.5">
                <button className={chip(value.token === "all")} onClick={() => onChange({ ...value, token: "all" })}>
                  All
                </button>
                {tokens.map((t) => (
                  <button key={t} className={chip(value.token === t)} onClick={() => onChange({ ...value, token: t })}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ActivityList({ mode }: { mode: "home" | "full" }) {
  const { items, live } = useActivity();
  const [filters, setFilters] = useState<Filters>({ source: "all", chain: "all", token: "all" });
  const [visible, setVisible] = useState(mode === "home" ? 5 : 15);

  const chains = useMemo(
    () =>
      Array.from(
        new Map(items.filter((i) => i.chainKey).map((i) => [i.chainKey!, i.chainLabel!])).entries(),
      ).map(([key, label]) => ({ key, label })),
    [items],
  );
  const tokens = useMemo(() => Array.from(new Set(items.map((i) => i.symbol))), [items]);
  const hasBank = items.some((i) => i.source === "bank");

  const filtered = items.filter(
    (i) =>
      (filters.source === "all" || i.source === filters.source) &&
      (filters.chain === "all" || i.chainKey === filters.chain) &&
      (filters.token === "all" || i.symbol === filters.token),
  );
  const shown = filtered.slice(0, visible);

  if (!live || items.length === 0) return <EmptyState />;

  const sentN = filtered.filter((i) => i.kind === "sent" && i.source === "onchain").length;
  const recvN = filtered.filter((i) => i.kind === "received").length;
  const bankN = filtered.filter((i) => i.source === "bank").length;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold text-slate">
          {filtered.length} {filtered.length === 1 ? "transaction" : "transactions"}
        </div>
        <FilterMenu chains={chains} tokens={tokens} hasBank={hasBank} value={filters} onChange={(f) => { setFilters(f); setVisible(mode === "home" ? 5 : 15); }} />
      </div>

      {mode === "full" && (
        <div className="grid grid-cols-4 gap-2">
          {[
            ["Total", filtered.length],
            ["Received", recvN],
            ["Sent", sentN],
            ["Bank", bankN],
          ].map(([label, n]) => (
            <div key={label} className="rounded-2xl bg-snow border border-fog px-3 py-2.5 text-center shadow-card-flat">
              <div className="text-[18px] font-extrabold text-harbor numerals">{n}</div>
              <div className="text-[11px] font-semibold text-slate">{label}</div>
            </div>
          ))}
        </div>
      )}

      {shown.map((item) => (
        <Row key={item.id} item={item} />
      ))}

      {filtered.length === 0 && <div className="text-[13px] text-slate px-1 py-2">Nothing matches these filters.</div>}

      {mode === "home" && filtered.length > 5 && (
        <Link
          href="/history"
          className="w-full flex items-center justify-center gap-1 rounded-[20px] border border-fog bg-snow py-2.5 text-[13px] font-bold text-sky-deep hover:bg-cream transition"
        >
          See all activity <ChevronRight className="w-4 h-4" />
        </Link>
      )}
      {mode === "full" && filtered.length > visible && (
        <button
          onClick={() => setVisible((v) => v + 15)}
          className="w-full rounded-[20px] border border-fog bg-snow py-2.5 text-[13px] font-bold text-sky-deep hover:bg-cream transition"
        >
          Show more
        </button>
      )}
    </div>
  );
}
