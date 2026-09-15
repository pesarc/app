"use client";

// Responsive app shell — as little friction as possible.
//  • Mobile: a floating bottom tab bar (Home · Markets · Send · Agent · You)
//    with the Send action raised in the middle — five thumb targets, no header
//    clutter, no interface-mode toggle in the way (that lives in Settings now).
//  • Large screens: a persistent left sidebar rail with the full destination
//    list and the account footer.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  BarChart3,
  Bot,
  User,
  ArrowUpRight,
  QrCode,
  ArrowDownLeft,
  Sprout,
  Building2,
  MapPin,
  Plus,
} from "lucide-react";
import { site } from "@pesarc/sdk/site";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";

type Item = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };

// The primary tabs, shared by the mobile bar and the top of the desktop rail.
const PRIMARY: Item[] = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Markets", href: "/markets", icon: BarChart3 },
  { label: "Agent", href: "/agent", icon: Bot },
  { label: "You", href: "/you", icon: User },
];

// Everything else, reachable from the desktop rail and Home.
const SECONDARY: Item[] = [
  { label: "Send", href: "/send", icon: ArrowUpRight },
  { label: "Pay", href: "/pay", icon: QrCode },
  { label: "Receive", href: "/receive", icon: ArrowDownLeft },
  { label: "Add money", href: "/add", icon: Plus },
  { label: "Earn", href: "/earn", icon: Sprout },
  { label: "Business", href: "/business", icon: Building2 },
  { label: "Local", href: "/corridor", icon: MapPin },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-surface min-h-screen">
      {/* Desktop sidebar */}
      <Sidebar pathname={pathname} />

      {/* Content — offset by the rail on desktop, cleared above the bar on mobile */}
      <main className="lg:pl-64 pb-28 lg:pb-0">{children}</main>

      {/* Mobile bottom nav */}
      <BottomNav pathname={pathname} />
    </div>
  );
}

/* ---------------- Desktop sidebar ---------------- */

function Sidebar({ pathname }: { pathname: string }) {
  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-black/[0.06] bg-snow/60 backdrop-blur px-4 py-6">
      <Link href="/" className="flex items-center gap-2.5 px-2 mb-8">
        <span className="w-8 h-8 flex items-center justify-center rounded-xl bg-sky text-white font-extrabold text-sm shadow-pop-sm">
          P
        </span>
        <span className="text-lg font-extrabold tracking-tight text-harbor">
          {site.name}
        </span>
      </Link>

      <nav className="flex flex-col gap-1">
        {PRIMARY.map((it) => (
          <RailLink key={it.href} item={it} active={isActive(pathname, it.href)} />
        ))}
      </nav>

      <div className="mt-6 mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-slate">
        Money
      </div>
      <nav className="flex flex-col gap-1">
        {SECONDARY.map((it) => (
          <RailLink key={it.href} item={it} active={isActive(pathname, it.href)} />
        ))}
      </nav>

      <div className="mt-auto">
        <AccountFooter />
      </div>
    </aside>
  );
}

function RailLink({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-pill px-3 py-2.5 text-sm font-semibold transition-colors ${
        active
          ? "bg-sky-tint/60 text-harbor"
          : "text-slate hover:text-harbor hover:bg-black/[0.03]"
      }`}
    >
      <Icon className="w-[18px] h-[18px]" />
      {item.label}
    </Link>
  );
}

/* ---------------- Mobile bottom nav ---------------- */

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="lg:hidden fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-4 mb-4 h-[66px] rounded-pill bg-snow border border-black/[0.06] shadow-[rgba(0,0,0,0.06)_0px_4px_0px_0px] flex items-center justify-around px-2 relative">
        <TabItem item={PRIMARY[0]} active={isActive(pathname, "/home")} />
        <TabItem item={PRIMARY[1]} active={isActive(pathname, "/markets")} />

        {/* Raised center Send action */}
        <Link href="/send" aria-label="Send" className="flex flex-col items-center">
          <span className="w-[46px] h-[46px] -mt-6 rounded-full bg-sky text-white flex items-center justify-center shadow-[rgba(154,207,246,0.6)_0px_4px_0px_0px] active:translate-y-0.5 transition-transform">
            <ArrowUpRight className="w-6 h-6" />
          </span>
        </Link>

        <TabItem item={PRIMARY[2]} active={isActive(pathname, "/agent")} />
        <TabItem item={PRIMARY[3]} active={isActive(pathname, "/you")} />
      </div>
    </nav>
  );
}

function TabItem({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex flex-col items-center gap-0.5 w-14 ${
        active ? "text-harbor" : "text-slate"
      }`}
    >
      <Icon className="w-[22px] h-[22px]" />
      <span className={`text-[11px] ${active ? "font-extrabold" : "font-semibold"}`}>
        {item.label}
      </span>
    </Link>
  );
}

/* ---------------- Account footer (desktop rail) ---------------- */

function AccountFooter() {
  const { mode, ready, authenticated, address, alias, login, logout } = useWallet();

  if (mode === "mock") {
    return (
      <div className="flex items-center gap-2.5 rounded-pill bg-black/[0.04] px-3 py-2.5 text-xs font-semibold text-slate">
        <span className="w-1.5 h-1.5 rounded-full bg-harbor" />
        {alias} · demo
      </div>
    );
  }
  if (!ready) {
    return <div className="h-11 rounded-pill bg-black/[0.05] animate-pulse" />;
  }
  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="w-full rounded-pill bg-sky px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-deep transition-colors shadow-pop-sm"
      >
        Sign in
      </button>
    );
  }
  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : alias;
  return (
    <button
      onClick={logout}
      title="Sign out"
      className="w-full inline-flex items-center gap-2 rounded-pill bg-sky-tint/60 px-3 py-2.5 text-xs font-bold text-harbor hover:bg-sky-tint transition-colors"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-sky" />
      {short}
    </button>
  );
}
