"use client";

// Invest — buy stocks & ETFs across Global-South and global markets in each
// market's local currency. Demo/paper-trade: a "buy" records a local holding
// (localStorage) and updates the portfolio; a real deployment routes to a
// tokenized-equity / broker adapter. No real securities order is placed.

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, X, Check, Search } from "lucide-react";
import {
  INSTRUMENTS,
  MARKETS,
  filterInstruments,
  marketOf,
  type Instrument,
  type InstrumentFilter,
} from "@pesarc/sdk/invest";
import { formatMoney, formatNumber, midMarketRate, CURRENCIES } from "@pesarc/sdk/money";
import { usePrefs } from "@pesarc/sdk/prefs";
import { Stagger, StaggerItem } from "@/components/motion";

type Holding = { symbol: string; shares: number; costCcy: string; cost: number };
const KEY = "pesarc.holdings";

function loadHoldings(): Holding[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Holding[]) : [];
  } catch {
    return [];
  }
}

const FILTERS: { value: InstrumentFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "stock", label: "Stocks" },
  { value: "etf", label: "ETFs" },
  ...Object.values(MARKETS).map((m) => ({ value: m.code, label: `${m.flag} ${m.code}` })),
];

export default function InvestView() {
  const { sendCurrency } = usePrefs();
  const [filter, setFilter] = useState<InstrumentFilter>("all");
  const [query, setQuery] = useState("");
  const [ticket, setTicket] = useState<Instrument | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);

  useEffect(() => setHoldings(loadHoldings()), []);

  const buy = (inst: Instrument, shares: number) => {
    const m = marketOf(inst);
    const cost = shares * inst.price;
    setHoldings((prev) => {
      const existing = prev.find((h) => h.symbol === inst.symbol);
      const next = existing
        ? prev.map((h) =>
            h.symbol === inst.symbol
              ? { ...h, shares: h.shares + shares, cost: h.cost + cost }
              : h
          )
        : [...prev, { symbol: inst.symbol, shares, costCcy: m.currency, cost }];
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    setTicket(null);
  };

  // Portfolio value in the user's default currency (cross-FX via midMarketRate).
  const portfolio = useMemo(() => {
    let value = 0;
    for (const h of holdings) {
      const inst = INSTRUMENTS.find((i) => i.symbol === h.symbol);
      if (!inst) continue;
      const m = marketOf(inst);
      value += h.shares * inst.price * midMarketRate(m.currency, sendCurrency);
    }
    return value;
  }, [holdings, sendCurrency]);

  const list = useMemo(() => {
    const base = filterInstruments(filter);
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter(
      (i) => i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)
    );
  }, [filter, query]);

  return (
    <div className="mx-auto w-full max-w-md lg:max-w-5xl px-4 sm:px-6 py-6 md:py-10">
      <header className="mb-4">
        <h1 className="text-[27px] font-extrabold text-harbor tracking-tight">Invest</h1>
        <p className="text-sm font-medium text-slate mt-1.5 leading-relaxed max-w-xl">
          Buy stocks &amp; ETFs across African and global markets — priced and settled in local
          currency, no dollar in the path.
        </p>
      </header>

      {/* Portfolio + search */}
      <div className="lg:grid lg:grid-cols-[1.2fr_1fr] lg:gap-8 lg:items-start">
        <div>
          <div className="relative overflow-hidden rounded-card-lg bg-harbor text-white p-6 mb-4 shadow-[rgba(19,66,111,0.28)_0px_8px_0px_0px]">
            <svg viewBox="0 0 390 200" fill="none" aria-hidden className="absolute inset-0 w-full h-full opacity-40 pointer-events-none">
              <path d="M-20 170 C 90 120, 160 60, 230 90 S 350 40, 420 70" stroke="#50a7ff" strokeWidth="1.6" fill="none" />
            </svg>
            <div className="relative">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60 mb-2">
                Your portfolio
              </div>
              <div className="text-4xl font-extrabold tracking-tight numerals mb-1">
                {formatMoney(portfolio, sendCurrency)}
              </div>
              <div className="text-[13px] text-white/60 font-medium">
                {holdings.length === 0
                  ? "No positions yet — buy your first below."
                  : `${holdings.length} position${holdings.length > 1 ? "s" : ""} · valued in ${sendCurrency}`}
              </div>
            </div>
          </div>

          {holdings.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5 mb-6">
              {holdings.map((h) => {
                const inst = INSTRUMENTS.find((i) => i.symbol === h.symbol);
                if (!inst) return null;
                const m = marketOf(inst);
                return (
                  <div key={h.symbol} className="bg-snow border border-fog rounded-2xl p-3.5 shadow-card-flat">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-harbor">{h.symbol}</span>
                      <span className="text-sm">{m.flag}</span>
                    </div>
                    <div className="text-[12px] text-slate font-medium mt-0.5">
                      {formatNumber(h.shares, "USD")} shares
                    </div>
                    <div className="text-[13px] font-bold text-ink numerals mt-1">
                      {formatMoney(h.shares * inst.price, m.currency)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search symbol or name"
              aria-label="Search instruments"
              className="w-full bg-snow rounded-field border border-fog pl-11 pr-4 py-3 text-[15px] text-ink placeholder:text-slate/70 shadow-card-flat focus:outline-none focus:border-sky"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6 pb-1 mb-4">
            {FILTERS.map((f) => {
              const active = f.value === filter;
              return (
                <button
                  key={String(f.value)}
                  onClick={() => setFilter(f.value)}
                  className={`shrink-0 rounded-full px-[18px] py-2 text-[13.5px] font-bold transition-colors ${
                    active ? "bg-harbor text-white" : "bg-snow border border-fog text-slate hover:text-harbor"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <Stagger className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {list.map((inst) => (
              <StaggerItem key={inst.symbol} pop>
                <InstrumentCard inst={inst} onBuy={() => setTicket(inst)} />
              </StaggerItem>
            ))}
            {list.length === 0 && (
              <p className="text-sm text-slate py-8 text-center sm:col-span-2">
                Nothing matches — try another market or search.
              </p>
            )}
          </Stagger>
        </div>
      </div>

      <AnimatePresence>
        {ticket && <BuySheet inst={ticket} onClose={() => setTicket(null)} onBuy={buy} />}
      </AnimatePresence>
    </div>
  );
}

function InstrumentCard({ inst, onBuy }: { inst: Instrument; onBuy: () => void }) {
  const m = marketOf(inst);
  const up = inst.change >= 0;
  return (
    <div className="bg-snow border border-fog rounded-card p-4 shadow-card-flat flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-extrabold text-harbor">{inst.symbol}</span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate bg-black/[0.05] rounded-full px-2 py-0.5">
              {inst.type}
            </span>
          </div>
          <div className="text-[12.5px] text-slate font-medium truncate max-w-[180px]">{inst.name}</div>
        </div>
        <span className="text-lg" title={m.name}>{m.flag}</span>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="text-[18px] font-extrabold text-ink numerals leading-none">
            {formatMoney(inst.price, m.currency)}
          </div>
          <div className={`inline-flex items-center gap-1 mt-1.5 text-[12px] font-bold ${up ? "text-sky-deep" : "text-alert"}`}>
            {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {up ? "+" : ""}{inst.change.toFixed(1)}%
          </div>
        </div>
        <button
          onClick={onBuy}
          className="rounded-2xl bg-sky text-white px-4 py-2 text-sm font-extrabold shadow-pop-sm hover:-translate-y-0.5 transition-transform"
        >
          Buy
        </button>
      </div>
    </div>
  );
}

function BuySheet({
  inst,
  onClose,
  onBuy,
}: {
  inst: Instrument;
  onClose: () => void;
  onBuy: (inst: Instrument, shares: number) => void;
}) {
  const m = marketOf(inst);
  const [sharesStr, setSharesStr] = useState("1");
  const shares = parseFloat(sharesStr) || 0;
  const cost = shares * inst.price;
  const valid = shares > 0;

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-x-0 bottom-0 z-50 bg-cream rounded-t-[30px] p-6 max-w-md mx-auto shadow-[0_-8px_40px_rgba(0,0,0,0.15)]"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="text-xl font-extrabold text-harbor">Buy {inst.symbol}</div>
            <div className="text-[13px] text-slate font-medium">
              {inst.name} · {m.flag} {m.code}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-snow border border-fog flex items-center justify-center text-harbor">
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block text-[11px] font-bold uppercase tracking-widest text-slate mb-2">Shares</label>
        <div className="flex gap-2 mb-4">
          {["1", "5", "10", "25"].map((v) => (
            <button
              key={v}
              onClick={() => setSharesStr(v)}
              className={`flex-1 rounded-[14px] border py-2.5 text-sm font-bold transition-colors ${
                sharesStr === v ? "bg-sky-tint/50 border-sky text-sky-deep" : "bg-snow border-fog text-harbor"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <input
          value={sharesStr}
          onChange={(e) => setSharesStr(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal"
          aria-label="Number of shares"
          className="w-full bg-snow rounded-field border border-fog px-4 py-3 text-[15px] text-ink numerals focus:outline-none focus:border-sky mb-4"
        />

        <div className="flex items-center justify-between rounded-2xl bg-harbor/5 px-4 py-3.5 mb-5">
          <span className="text-[13.5px] font-semibold text-harbor">Estimated cost</span>
          <span className="text-lg font-extrabold text-harbor numerals">{formatMoney(cost, m.currency)}</span>
        </div>

        <button
          disabled={!valid}
          onClick={() => onBuy(inst, shares)}
          className="w-full flex items-center justify-center gap-2 bg-sky text-white rounded-btn py-4 text-base font-extrabold shadow-pop hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:translate-y-0"
        >
          <Check className="w-5 h-5" /> Buy {shares > 0 ? formatNumber(shares, "USD") : ""} {inst.symbol}
        </button>
        <p className="text-center text-[11.5px] text-slate mt-3">
          Demo — records a paper position. No real order is placed.
        </p>
      </motion.div>
    </>
  );
}
