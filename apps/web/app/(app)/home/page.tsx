import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Plus, QrCode } from "lucide-react";
import { ACCOUNT, ACTIVITY } from "@pesarc/sdk/account";
import { listTransfers } from "@pesarc/sdk/transfers";
import { formatMoney } from "@pesarc/sdk/money";
import type { CurrencyCode } from "@pesarc/sdk/money";
import { Card } from "@/components/app/ui";
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

export default async function HomePage() {
  const rows = await listTransfers();

  // DB transfers (mock-mode fallback); the client feed swaps in the wallet's
  // real on-chain history when a live wallet is connected.
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
    <div className="max-w-md mx-auto px-4 sm:px-6 py-8 md:py-12">
      {/* Balance */}
      <Reveal>
        <Card className="p-6 mb-4 rounded-card-lg bg-gradient-to-br from-harbor to-[#0e3358] border-0 text-white shadow-card-flat">
          <div className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-2">
            Your balance
          </div>
          <div className="text-5xl font-semibold numerals mb-1">
            <LiveBalance fallback={formatMoney(ACCOUNT.balance, ACCOUNT.currency)} />
          </div>
          <div className="text-sm text-white/70">Available now · gasless</div>
        </Card>
      </Reveal>

      {/* Primary actions */}
      <Stagger className="grid grid-cols-3 gap-3 mb-8">
        <StaggerItem pop className="h-full">
          <Link href="/send">
            <Card className="p-4 flex flex-col items-start gap-3 hover:border-sky/40 hover:shadow-pop-sm hover:-translate-y-0.5 transition h-full">
              <span className="w-10 h-10 rounded-full bg-sky-tint flex items-center justify-center text-sky">
                <ArrowUpRight className="w-5 h-5" />
              </span>
              <span className="font-semibold text-harbor">Send</span>
            </Card>
          </Link>
        </StaggerItem>
        <StaggerItem pop className="h-full">
          <Link href="/receive">
            <Card className="p-4 flex flex-col items-start gap-3 hover:border-sky/40 hover:shadow-pop-sm hover:-translate-y-0.5 transition h-full">
              <span className="w-10 h-10 rounded-full bg-harbor/10 flex items-center justify-center text-harbor">
                <ArrowDownLeft className="w-5 h-5" />
              </span>
              <span className="font-semibold text-harbor">Receive</span>
            </Card>
          </Link>
        </StaggerItem>
        <StaggerItem pop className="h-full">
          <Link href="/pay">
            <Card className="p-4 flex flex-col items-start gap-3 hover:border-sky/40 hover:shadow-pop-sm hover:-translate-y-0.5 transition h-full">
              <span className="w-10 h-10 rounded-full bg-sky-tint flex items-center justify-center text-sky">
                <QrCode className="w-5 h-5" />
              </span>
              <span className="font-semibold text-harbor">Pay</span>
            </Card>
          </Link>
        </StaggerItem>
      </Stagger>

      {/* Activity */}
      <Reveal delay={0.12}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-widest">
            Recent activity
          </h2>
          <Link
            href="/add"
            className="inline-flex items-center gap-1 text-sm font-medium text-sky hover:underline"
          >
            <Plus className="w-4 h-4" /> Add money
          </Link>
        </div>

        <ActivityFeed fallback={fallback} />
      </Reveal>
    </div>
  );
}
