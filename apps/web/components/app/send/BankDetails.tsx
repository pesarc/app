"use client";

// Bank + account-number capture for a fiat (bank) payout, with live account-name
// resolution — the "enter account number → name appears" pattern people expect
// from OPay/bank apps. Emits a value only when the destination is usable, so the
// Send flow can gate the Review button on a real bank destination.

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { Select } from "@/components/app/ui";

export type BankDestination = {
  bankCode: string;
  accountNumber: string;
  /** Verified holder name (Paystack). Absent in demo — the payout still fires. */
  accountName?: string;
};

type Bank = { name: string; code: string };
type Resolve = { state: "idle" | "loading" | "ok" | "unverified" | "error"; name?: string; error?: string };

export default function BankDetails({
  onChange,
}: {
  onChange: (v: BankDestination | null) => void;
}) {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolve, setResolve] = useState<Resolve>({ state: "idle" });
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Load the bank list once.
  useEffect(() => {
    let alive = true;
    fetch("/api/banks?currency=NGN")
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.ok) setBanks(d.banks as Bank[]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const ready = bankCode !== "" && /^\d{10}$/.test(accountNumber);

  // Resolve the account name when we have a bank + a 10-digit number (debounced).
  useEffect(() => {
    if (!ready) {
      setResolve({ state: "idle" });
      onChangeRef.current(null);
      return;
    }
    setResolve({ state: "loading" });
    let alive = true;
    const t = setTimeout(() => {
      fetch("/api/banks/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountNumber, bankCode }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          if (!d?.ok) {
            setResolve({ state: "error", error: d?.error ?? "Couldn't verify this account." });
            onChangeRef.current(null);
          } else if (d.resolved && d.accountName) {
            setResolve({ state: "ok", name: d.accountName });
            onChangeRef.current({ bankCode, accountNumber, accountName: d.accountName });
          } else {
            // Demo / no provider — proceed without a verified name.
            setResolve({ state: "unverified" });
            onChangeRef.current({ bankCode, accountNumber });
          }
        })
        .catch(() => {
          if (!alive) return;
          setResolve({ state: "error", error: "Couldn't reach the bank right now." });
          onChangeRef.current(null);
        });
    }, 450);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [ready, accountNumber, bankCode]);

  return (
    <div className="rounded-[18px] border border-fog bg-snow p-3.5 space-y-3">
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-widest text-slate mb-1.5">
          Bank
        </label>
        <Select value={bankCode} onChange={(e) => setBankCode(e.target.value)}>
          <option value="">Select bank</option>
          {banks.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-widest text-slate mb-1.5">
          Account number
        </label>
        <input
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
          inputMode="numeric"
          placeholder="10-digit NUBAN"
          aria-label="Account number"
          className="w-full rounded-[14px] border border-fog bg-white px-3.5 py-3 text-[15px] font-semibold text-harbor tracking-wide outline-none focus:border-sky numerals"
        />
      </div>

      {/* Resolution feedback */}
      {resolve.state === "loading" && (
        <div className="flex items-center gap-2 text-[13px] font-medium text-slate">
          <Loader2 className="w-4 h-4 animate-spin" /> Checking account…
        </div>
      )}
      {resolve.state === "ok" && (
        <div className="flex items-center gap-2 rounded-[12px] bg-success/10 px-3 py-2 text-[13px] font-bold text-success">
          <Check className="w-4 h-4 shrink-0" /> {resolve.name}
        </div>
      )}
      {resolve.state === "unverified" && (
        <div className="flex items-center gap-2 text-[12.5px] font-medium text-slate">
          <Check className="w-3.5 h-3.5 text-sky-deep shrink-0" /> We&apos;ll confirm the account
          name when the payout is sent.
        </div>
      )}
      {resolve.state === "error" && (
        <div className="flex items-center gap-2 rounded-[12px] bg-alert/10 px-3 py-2 text-[13px] font-medium text-alert">
          <AlertCircle className="w-4 h-4 shrink-0" /> {resolve.error}
        </div>
      )}
    </div>
  );
}
