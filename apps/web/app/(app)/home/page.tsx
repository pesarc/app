import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, ArrowDownLeft, QrCode, Plus } from "@/components/icons";
import { NotificationsBell } from "@/components/app/NotificationsBell";
import { ACCOUNT } from "@pesarc/sdk/account";
import { listTransfers } from "@pesarc/sdk/transfers";
import { formatMoney } from "@pesarc/sdk/money";
import type { CurrencyCode } from "@pesarc/sdk/money";
import { LiveBalance } from "@/components/app/LiveBalance";
import SendAbroad from "@/components/app/SendAbroad";
import { ActivityFeed, type FallbackItem, type ActivityType } from "@/components/app/ActivityFeed";
import { LiveHoldings } from "@/components/app/LiveHoldings";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Your Pesarc balance and open positions, with one tap to trade the day's markets.",
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

// Classify a transfer into an activity type for its leading icon, from the
// payout method and direction.
function activityType(payout: string, direction: "sent" | "received"): ActivityType {
  const p = (payout || "").toLowerCase();
  if (p.includes("swap")) return "swap";
  if (p.includes("bill") || p.includes("airtime") || p.includes("data") || p.includes("electric")) return "bill";
  if (p.includes("earn") || p.includes("deposit") || p.includes("save") || p.includes("stake")) return "earn";
  if (p.includes("bank") || p.includes("mobile") || p.includes("cash")) return "bank";
  if (p.includes("qr") || p.includes("pay") || p.includes("checkout")) return "pay";
  return direction === "sent" ? "send" : "receive";
}

export default async function HomePage() {
  // Never let a slow or failing data source take the whole page down. Race the
  // fetch against a short timeout and fall back to sample activity, so a DB
  // hang or error can't 500 the home screen (the primary surface).
  let rows: Awaited<ReturnType<typeof listTransfers>> = [];
  try {
    rows = await Promise.race([
      listTransfers(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 2500)),
    ]);
  } catch {
    rows = [];
  }

  // Real transfers only, newest first. No mock data: an empty list renders the
  // ActivityFeed's empty state.
  const fallback: FallbackItem[] = rows.map((r) => ({
    id: r.id,
    kind: r.direction,
    counterparty: r.counterparty,
    amountLabel: formatMoney(r.sendAmount, r.sendCurrency as CurrencyCode),
    when: timeAgo(r.createdAt),
    flag: r.flag ?? "🌍",
    type: activityType(r.payout, r.direction),
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
          <NotificationsBell />
          <Link
            href="/you"
            aria-label="Your profile and settings"
            className="w-[42px] h-[42px] rounded-full bg-harbor text-white flex items-center justify-center font-extrabold text-[15px] hover:opacity-90 transition-opacity"
          >
            {ACCOUNT.name.slice(0, 1)}
          </Link>
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
                  <Link
                    href="/add"
                    className="inline-flex items-center gap-1.5 rounded-full bg-white text-harbor text-[12px] font-extrabold px-3 py-1.5 shadow-sm hover:-translate-y-0.5 transition-transform"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add money
                  </Link>
                </div>

                <div className="text-5xl font-extrabold tracking-tight numerals mb-2.5">
                  <LiveBalance fallback={formatMoney(0, ACCOUNT.currency)} />
                </div>

                <LiveHoldings />
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

          {/* Corridors — live rates + user-pinned corridors */}
          <SendAbroad />
        </div>

        {/* Right column — activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-bold uppercase tracking-widest text-slate">
              Activity
            </h2>
          </div>
          <ActivityFeed fallback={fallback} />
        </div>
      </div>
    </div>
  );
}
