"use client";

// You — profile + settings. This is where the interface-complexity toggle and
// the default currency live now, off the main navigation, so the money screens
// stay uncluttered.

import { useState } from "react";
import Link from "next/link";
import {
  Sprout,
  Building2,
  MapPin,
  QrCode,
  ArrowDownLeft,
  Plus,
  ChevronRight,
  LogOut,
  BadgeCheck,
  ShieldCheck,
  Loader2,
  LineChart,
  Settings2,
} from "lucide-react";
import { useUIMode } from "@pesarc/sdk/ui-mode";
import { usePrefs } from "@pesarc/sdk/prefs";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import { SEND_CURRENCIES, CURRENCIES, type CurrencyCode } from "@pesarc/sdk/money";
import { ACCOUNT } from "@pesarc/sdk/account";
import { Segmented } from "@/components/app/ui";

const MORE = [
  { label: "Invest", href: "/invest", icon: LineChart },
  { label: "Pay", href: "/pay", icon: QrCode },
  { label: "Receive", href: "/receive", icon: ArrowDownLeft },
  { label: "Add money", href: "/add", icon: Plus },
  { label: "Earn", href: "/earn", icon: Sprout },
  { label: "Business", href: "/business", icon: Building2 },
  { label: "Local", href: "/corridor", icon: MapPin },
  { label: "Admin", href: "/admin", icon: Settings2 },
];

export default function YouPage() {
  const { mode, setMode } = useUIMode();
  const { sendCurrency, setSendCurrency, kyc, setKyc } = usePrefs();
  const { mode: walletMode, authenticated, address, alias, login, logout } = useWallet();

  const signedIn = walletMode === "mock" || authenticated;
  const identity = walletMode === "mock"
    ? `${alias} · demo`
    : address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : alias;

  return (
    <div className="mx-auto w-full max-w-md lg:max-w-2xl px-4 sm:px-6 py-6 md:py-10">
      <h1 className="text-[27px] font-extrabold text-harbor tracking-tight mb-5">You</h1>

      {/* Account */}
      <div className="rounded-card bg-harbor text-white p-5 mb-4 shadow-[rgba(19,66,111,0.28)_0px_8px_0px_0px]">
        <div className="flex items-center gap-3.5">
          <span className="w-12 h-12 rounded-full bg-white/[0.14] flex items-center justify-center font-extrabold text-lg">
            {ACCOUNT.name.slice(0, 1)}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-widest text-white/60">
              {signedIn ? "Signed in" : "Not signed in"}
            </div>
            <div className="text-[15px] font-bold truncate">{signedIn ? identity : "Guest"}</div>
          </div>
        </div>
      </div>

      {/* Identity verification (KYC) */}
      <Section title="Verification">
        <VerificationRow kyc={kyc} setKyc={setKyc} />
      </Section>

      {/* Preferences */}
      <Section title="Preferences">
        <div className="flex items-center justify-between px-4 py-3.5">
          <div>
            <div className="text-[15px] font-bold text-ink">Interface</div>
            <div className="text-[12.5px] font-medium text-slate">
              Basic keeps it simple. Advanced shows routes, rates & fees.
            </div>
          </div>
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
        </div>

        <div className="border-t border-cream px-4 py-3.5">
          <div className="text-[15px] font-bold text-ink">Default currency</div>
          <div className="text-[12.5px] font-medium text-slate mb-3">
            The currency you send in — set once, no picking every time.
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {SEND_CURRENCIES.map((code: CurrencyCode) => {
              const active = code === sendCurrency;
              return (
                <button
                  key={code}
                  onClick={() => setSendCurrency(code)}
                  className={`flex items-center justify-center gap-1.5 rounded-[14px] border py-2.5 text-sm font-bold transition-colors ${
                    active
                      ? "bg-sky-tint/50 border-sky text-sky-deep"
                      : "bg-snow border-fog text-harbor hover:border-slate/50"
                  }`}
                >
                  <span>{CURRENCIES[code].flag}</span> {code}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      {/* More destinations */}
      <Section title="More">
        {MORE.map((m, i) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.href}
              href={m.href}
              className={`flex items-center gap-3 px-4 py-3.5 hover:bg-black/[0.02] transition-colors ${
                i > 0 ? "border-t border-cream" : ""
              }`}
            >
              <span className="w-9 h-9 rounded-full bg-cream flex items-center justify-center text-harbor">
                <Icon className="w-[18px] h-[18px]" />
              </span>
              <span className="flex-1 text-[15px] font-bold text-ink">{m.label}</span>
              <ChevronRight className="w-5 h-5 text-slate" />
            </Link>
          );
        })}
      </Section>

      {/* Auth */}
      {walletMode !== "mock" && (
        <button
          onClick={authenticated ? logout : login}
          className="w-full flex items-center justify-center gap-2 rounded-pill bg-snow border border-fog py-3.5 text-sm font-bold text-harbor hover:border-slate/50 transition-colors"
        >
          {authenticated ? <LogOut className="w-4 h-4" /> : null}
          {authenticated ? "Sign out" : "Sign in"}
        </button>
      )}
    </div>
  );
}

function VerificationRow({
  kyc,
  setKyc,
}: {
  kyc: "unverified" | "pending" | "verified";
  setKyc: (s: "unverified" | "pending" | "verified") => void;
}) {
  const [starting, setStarting] = useState(false);

  // Demo verification: pending → verified after a short review. A real KYC
  // provider (Persona/Sumsub) would drive this from a verified webhook.
  const start = () => {
    setStarting(true);
    setKyc("pending");
    setTimeout(() => {
      setKyc("verified");
      setStarting(false);
    }, 2500);
  };

  return (
    <div className="flex items-center gap-3.5 px-4 py-4">
      <span
        className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${
          kyc === "verified" ? "bg-sky-tint/60 text-sky-deep" : "bg-cream text-harbor"
        }`}
      >
        {kyc === "verified" ? <BadgeCheck className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-bold text-ink">Identity verification</div>
        <div className="text-[12.5px] font-medium text-slate">
          {kyc === "verified"
            ? "Verified — bank & mobile-money payouts unlocked."
            : kyc === "pending"
            ? "Reviewing your details…"
            : "Verify once to receive fiat payouts to a bank or wallet."}
        </div>
      </div>
      {kyc === "verified" ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-tint/60 text-sky-deep text-[11px] font-extrabold px-2.5 py-1">
          <BadgeCheck className="w-3.5 h-3.5" /> Verified
        </span>
      ) : (
        <button
          onClick={start}
          disabled={kyc === "pending" || starting}
          className="inline-flex items-center gap-1.5 rounded-pill bg-sky text-white text-sm font-bold px-4 py-2 shadow-pop-sm hover:-translate-y-0.5 transition-transform disabled:opacity-60 disabled:translate-y-0"
        >
          {kyc === "pending" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Reviewing
            </>
          ) : (
            "Verify"
          )}
        </button>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="px-1 mb-2 text-[11px] font-bold uppercase tracking-widest text-slate">
        {title}
      </div>
      <div className="rounded-card bg-snow border border-fog shadow-card-flat overflow-hidden">
        {children}
      </div>
    </div>
  );
}
