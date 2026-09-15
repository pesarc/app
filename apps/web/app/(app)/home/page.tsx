import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, ArrowDownLeft, QrCode, Bell, Plus, TrendingUp } from "lucide-react";
import { ACCOUNT, ACTIVITY } from "@pesarc/sdk/account";
import { listTransfers } from "@pesarc/sdk/transfers";
import { formatMoney, formatNumber, midMarketRate, CURRENCIES } from "@pesarc/sdk/money";
import type { CurrencyCode } from "@pesarc/sdk/money";
import { LiveBalance } from "@/components/app/LiveBalance";
import { ActivityFeed, type FallbackItem } from "@/components/app/ActivityFeed";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Your Pesarc balance, with one tap to send or receive money across borders.",
};

export const dynamic = "force-dynamic";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "Yesterday" : `${d}d ago`;
}

// Illustrative local-currency holdings shown as chips on the balance hero.
const HOLDINGS = [
  { flag: "🇳🇬", code: "cNGN", amount: "₦1.24m" },
  { flag: "🇰🇪", code: "cKES", amount: "KSh 98k" },
  { flag: "🇬🇭", code: "cGHS", amount: "₵ 4.1k" },
];

// Live corridor lanes — the settlement network, made visible.
const CORRIDORS: { from: CurrencyCode; to: CurrencyCode }[] = [
  { from: "GBP", to: "NGN" },
  { from: "USD", to: "NGN" },
  { from: "GBP", to: "KES" },
];

export default async function HomePage() {
  const rows = await listTransfers();

  const fallback: FallbackItem[] = (rows.length
    ? rows.map((r) => ({
        id: r.id,
        kind: r.direction,
        counterparty: r.counterparty,
        amount: r.sendAmount,
        currency: r.sendCurrency as CurrencyCode,
        when: timeAgo(r.createdAt),
        flag: r.flag ?? "🌍",
      }))
    : ACTIVITY
  ).map((a) => ({
    id: a.id,
    kind: a.kind,
    counterparty: a.counterparty,
    amountLabel: formatMoney(a.amount, a.currency),
    when: a.when,
    flag: a.flag,
  }));

  return (
    <div className="mx-auto w-full max-w-md lg:max-w-5xl px-4 sm:px-6 py-6 md:py-10">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col">
          <span className="text-[13px] font-medium text-slate">Good morning</span>
          <span className="text-xl font-extrabold tracking-tight text-harbor">Welcome back</span>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            aria-label="Notifications"
            className="w-[42px] h-[42px] rounded-full bg-snow border border-fog shadow-card-flat flex items-center justify-center text-harbor"
          >
            <Bell className="w-5 h-5" />
          </button>
          <span className="w-[42px] h-[42px] rounded-full bg-harbor text-white flex items-center justify-center font-extrabold text-[15px]">
            {ACCOUNT.name.slice(0, 1)}
          </span>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[1.3fr_1fr] lg:gap-8 lg:items-start">
        {/* Left column */}
        <div>
          {/* Balance hero */}
          <Reveal>
            <div className="relative overflow-hidden rounded-card-lg bg-harbor text-white p-6 md:p-7 mb-4 shadow-[rgba(19,66,111,0.28)_0px_8px_0px_0px]">
              <svg
                width="100%"
                height="240"
                viewBox="0 0 390 240"
                fill="none"
                aria-hidden
                className="absolute inset-0 opacity-50 pointer-events-none"
              >
                <path d="M-20 250 C 90 90, 300 90, 420 250" stroke="#50a7ff" strokeOpacity="0.55" strokeWidth="1.5" />
                <path d="M-20 300 C 110 120, 280 120, 420 300" stroke="#2e96ff" strokeOpacity="0.25" strokeWidth="1.5" />
                <path d="M-40 210 C 120 60, 270 60, 440 210" stroke="#2e96ff" strokeOpacity="0.18" strokeWidth="1.5" strokeDasharray="2 6" />
                <circle cx="300" cy="103" r="4" fill="#bde1f9" />
                <circle cx="300" cy="103" r="9" fill="#2e96ff" fillOpacity="0.2" />
              </svg>

              <div className="relative">
                <div className="flex items-center justify-between mb-3.5">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">
                    Total balance
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sky/20 text-sky-tint text-[11px] font-bold px-2.5 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-mid ring-4 ring-sky-mid/30" />
                    Gasless
                  </span>
                </div>

                <div className="text-5xl font-extrabold tracking-tight numerals mb-2.5">
                  <LiveBalance fallback={formatMoney(ACCOUNT.balance, ACCOUNT.currency)} />
                </div>

                <div className="flex gap-2 mt-4">
                  {HOLDINGS.map((h) => (
                    <div key={h.code} className="flex-1 rounded-2xl bg-white/[0.08] px-3 py-2.5">
                      <div className="text-[11px] font-semibold text-white/60 mb-0.5">
                        {h.flag} {h.code}
                      </div>
                      <div className="text-[15px] font-bold numerals">{h.amount}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          {/* Primary actions */}
          <Stagger className="flex gap-2.5 mb-8">
            <StaggerItem pop className="flex-[1.4]">
              <Link
                href="/send"
                className="h-full flex flex-col items-start justify-between gap-5 bg-sky text-white rounded-card p-4 shadow-pop hover:-translate-y-0.5 transition-transform min-h-[108px]"
              >
                <span className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5" />
                </span>
                <span className="text-base font-bold">Send</span>
              </Link>
            </StaggerItem>
            <div className="flex-1 flex flex-col gap-2.5">
              <StaggerItem pop>
                <Link
                  href="/receive"
                  className="flex items-center gap-2.5 bg-snow text-harbor border border-fog rounded-[18px] px-3.5 py-3 shadow-card-flat hover:border-slate/50 transition-colors"
                >
                  <span className="w-8 h-8 rounded-full bg-cream flex items-center justify-center">
                    <ArrowDownLeft className="w-[17px] h-[17px]" />
                  </span>
                  <span className="text-sm font-bold">Receive</span>
                </Link>
              </StaggerItem>
              <StaggerItem pop>
                <Link
                  href="/pay"
                  className="flex items-center gap-2.5 bg-snow text-harbor border border-fog rounded-[18px] px-3.5 py-3 shadow-card-flat hover:border-slate/50 transition-colors"
                >
                  <span className="w-8 h-8 rounded-full bg-sky-tint flex items-center justify-center text-sky-deep">
                    <QrCode className="w-4 h-4" />
                  </span>
                  <span className="text-sm font-bold">Pay</span>
                </Link>
              </StaggerItem>
            </div>
          </Stagger>

          {/* Corridors */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-bold uppercase tracking-widest text-slate">
              Your corridors
            </h2>
            <Link href="/corridor" className="text-[13px] font-bold text-sky hover:text-sky-deep">
              Rates
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6 pb-2.5 mb-8">
            {CORRIDORS.map((c) => {
              const rate = midMarketRate(c.from, c.to);
              return (
                <div
                  key={`${c.from}-${c.to}`}
                  className="flex-none w-[168px] bg-snow border border-fog rounded-card p-4 shadow-card-flat"
                >
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-xl">{flagFor(c.from)}</span>
                    <svg width="34" height="14" viewBox="0 0 34 14" fill="none">
                      <path d="M2 11 C 10 1, 24 1, 32 11" stroke="#2e96ff" strokeWidth="1.6" strokeLinecap="round" />
                      <circle cx="32" cy="11" r="2.4" fill="#2e96ff" />
                    </svg>
                    <span className="text-xl">{flagFor(c.to)}</span>
                  </div>
                  <div className="text-[13px] font-semibold text-slate mb-0.5">
                    {c.from} → {c.to}
                  </div>
                  <div className="text-[19px] font-extrabold tracking-tight text-harbor numerals">
                    {CURRENCIES[c.to].symbol}
                    {formatNumber(rate, c.to)}
                  </div>
                  <div className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-sky-deep">
                    <TrendingUp className="w-3 h-3" /> live
                  </div>
                </div>
              );
            })}
            <Link
              href="/corridor"
              className="flex-none w-[118px] rounded-card border border-dashed border-sky-tint bg-sky-tint/25 p-4 flex flex-col items-start justify-center gap-2.5 text-sky-deep"
            >
              <span className="w-[34px] h-[34px] rounded-full bg-snow flex items-center justify-center">
                <Plus className="w-[18px] h-[18px]" />
              </span>
              <span className="text-[13px] font-bold leading-tight">
                New
                <br />
                corridor
              </span>
            </Link>
          </div>
        </div>

        {/* Right column — activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-bold uppercase tracking-widest text-slate">
              Activity
            </h2>
            <Link
              href="/add"
              className="inline-flex items-center gap-1 text-[13px] font-bold text-sky hover:text-sky-deep"
            >
              <Plus className="w-4 h-4" /> Add money
            </Link>
          </div>
          <ActivityFeed fallback={fallback} />
        </div>
      </div>
    </div>
  );
}

function flagFor(code: CurrencyCode): string {
  const map: Record<string, string> = {
    GBP: "🇬🇧",
    USD: "🇺🇸",
    EUR: "🇪🇺",
    NGN: "🇳🇬",
    KES: "🇰🇪",
    GHS: "🇬🇭",
  };
  return map[code] ?? "🌍";
}
