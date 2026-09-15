"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { site } from "@/lib/site";
import { useUIMode } from "@/lib/ui-mode";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { Segmented } from "@/components/app/ui";

export default function AppNav() {
  const pathname = usePathname();
  const { mode, setMode } = useUIMode();

  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-cloud/85 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald text-white font-semibold text-[11px]">
            SA
          </span>
          <span className="text-base tracking-tight text-deepink font-semibold">
            {site.name}
          </span>
        </Link>

        <nav className="hidden sm:flex items-center gap-1">
          {site.appNav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  active
                    ? "bg-emerald-50 text-emerald"
                    : "text-muted hover:text-deepink hover:bg-black/[0.04]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Segmented
            aria-label="Interface complexity"
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: "basic", label: "Basic" },
              { value: "advanced", label: "Advanced" },
            ]}
          />
          <AccountChip />
        </div>
      </div>
    </header>
  );
}

function AccountChip() {
  const { mode, ready, authenticated, address, alias, login, logout } =
    useWallet();

  // Mock mode: show the demo alias (no real auth yet).
  if (mode === "mock") {
    return (
      <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-black/[0.05] px-3 py-1.5 text-xs font-medium text-muted">
        <span className="w-1.5 h-1.5 rounded-full bg-gold" />
        {alias} · demo
      </span>
    );
  }

  if (!ready) {
    return (
      <span className="w-20 h-8 rounded-full bg-black/[0.05] animate-progress-pulse" />
    );
  }

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="rounded-full bg-emerald px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors"
      >
        Sign in
      </button>
    );
  }

  const short = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : alias;

  return (
    <button
      onClick={logout}
      title="Sign out"
      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald hover:bg-emerald/15 transition-colors"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
      {short}
    </button>
  );
}
