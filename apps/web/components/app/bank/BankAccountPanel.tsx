"use client";

// The web2 side of every account: a payout bank account. Nigerians link/create
// one with their BVN; once linked it shows the account for bank payouts. The BVN
// is sent once to create the account and never shown back or stored client-side.
// Provider is stubbed until PAYSTACK/FLUTTERWAVE keys are wired (server-side).

import { useEffect, useState } from "react";
import { Landmark, Check, Copy, Loader2, ShieldCheck } from "@/components/icons";
import { Button } from "@/components/app/ui";
import { authedFetch, authedPostJson } from "@pesarc/sdk/api/client";
import type { LinkedBankAccount } from "@pesarc/sdk/bank";

export default function BankAccountPanel() {
  const [account, setAccount] = useState<LinkedBankAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [bvn, setBvn] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    authedFetch("/api/bank")
      .then((r) => r.json())
      .then((j) => active && setAccount(j.account ?? null))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const link = async () => {
    setError("");
    if (!/^\d{11}$/.test(bvn.trim())) {
      setError("Enter a valid 11-digit BVN.");
      return;
    }
    setBusy(true);
    try {
      const res = await authedPostJson("/api/bank", {
        bvn: bvn.trim(),
        accountName: name.trim() || undefined,
      });
      const j = await res.json();
      if (j.ok && j.account) {
        setAccount(j.account as LinkedBankAccount);
        setBvn("");
      } else {
        setError(j.error ?? "Could not link your account.");
      }
    } catch {
      setError("Could not link your account.");
    }
    setBusy(false);
  };

  const copy = async () => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account.accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate py-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Checking your bank account…
      </div>
    );
  }

  if (account) {
    return (
      <div className="rounded-2xl border border-fog bg-snow p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-8 h-8 rounded-full bg-sky-tint text-sky-deep flex items-center justify-center">
            <Landmark className="w-4 h-4" />
          </span>
          <div>
            <div className="text-[14px] font-bold text-ink">Bank transfer</div>
            <div className="text-[12px] text-slate">Send money to this account to top up.</div>
          </div>
        </div>
        <button
          onClick={copy}
          className="w-full flex items-center justify-between gap-2 rounded-xl bg-black/[0.03] px-3.5 py-3 hover:bg-black/[0.05] transition text-left"
        >
          <div>
            <div className="text-[19px] font-extrabold text-ink numerals tracking-wide">
              {account.accountNumber}
            </div>
            <div className="text-[12px] text-slate">
              {account.bankName} · {account.accountName}
            </div>
          </div>
          {copied ? (
            <Check className="w-4 h-4 text-sky-deep shrink-0" />
          ) : (
            <Copy className="w-4 h-4 text-slate shrink-0" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-fog bg-snow p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-full bg-sky-tint text-sky-deep flex items-center justify-center">
          <Landmark className="w-4 h-4" />
        </span>
        <div className="text-[14px] font-bold text-ink">Add a bank account</div>
      </div>
      <p className="text-[12.5px] text-slate mb-3">
        Link your BVN and we&apos;ll set up an account for bank payouts. Nigeria only
        for now.
      </p>
      <div className="space-y-2">
        <input
          value={bvn}
          onChange={(e) => setBvn(e.target.value.replace(/\D/g, "").slice(0, 11))}
          inputMode="numeric"
          placeholder="11-digit BVN"
          aria-label="BVN"
          className="w-full rounded-xl border border-fog bg-white px-3.5 py-2.5 text-[15px] text-ink numerals outline-none focus:border-sky/50"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Account name (optional)"
          aria-label="Account name"
          className="w-full rounded-xl border border-fog bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-sky/50"
        />
      </div>
      {error && <p className="text-[12px] text-alert mt-2">{error}</p>}
      <Button block className="mt-3" onClick={link} disabled={busy}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
        Link with BVN
      </Button>
      <p className="text-[10.5px] text-slate/70 mt-2 flex items-center gap-1">
        <ShieldCheck className="w-3 h-3" /> Your BVN is used once to create the account and never stored.
      </p>
    </div>
  );
}
