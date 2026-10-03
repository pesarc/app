"use client";

import { useState } from "react";
import { Copy, Check } from "@/components/icons";
import type { IconType } from "@/components/icons";

// Small presentational building blocks shared by the Operations and
// Architecture admin tabs. Styling matches the Relief design system used across
// the app (snow cards, fog borders, harbor/slate type).

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[13px] font-bold uppercase tracking-widest text-slate mb-3">
      {children}
    </h2>
  );
}

export function Kpi({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon?: IconType;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const tones: Record<string, string> = {
    default: "text-harbor",
    good: "text-success",
    warn: "text-harbor",
    bad: "text-alert",
  };
  return (
    <div className="rounded-card bg-snow border border-black/[0.04] shadow-card-flat p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate mb-1.5">
        {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
        {label}
      </div>
      <div className={`text-[22px] font-extrabold tracking-tight ${tones[tone]}`}>{value}</div>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-success/12 text-success",
  processing: "bg-sky/12 text-sky",
  initiated: "bg-black/[0.05] text-slate",
  failed: "bg-alert/12 text-alert",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLE[status] ?? "bg-black/[0.05] text-slate";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${cls}`}>
      {status}
    </span>
  );
}

export function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <button
      onClick={copy}
      aria-label="Copy"
      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-cream text-harbor hover:bg-black/[0.05] transition-colors shrink-0"
    >
      {done ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-black/[0.05] px-2.5 py-0.5 text-[12px] font-semibold text-harbor">
      {children}
    </span>
  );
}

/** ₦-formatted NGN amount (no decimals — payouts are whole naira). */
export function ngn(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

/** Short money with currency code, for mixed-currency fee display. */
export function money(n: number, currency: string): string {
  const decimals = currency === "NGN" || currency === "KES" ? 0 : 2;
  return `${n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} ${currency}`;
}

/** Mask anything that looks like an account number / long digit string; leave
 *  human names intact. Admin-only, but we still avoid printing full NUBANs. */
export function maskBeneficiary(s: string): string {
  const digits = s.replace(/\D/g, "");
  if (digits.length >= 8) {
    return `${digits.slice(0, 2)}••••${digits.slice(-2)}`;
  }
  return s;
}

/** Compact ISO timestamp -> "3 Oct, 14:22". */
export function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
