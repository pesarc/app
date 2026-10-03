"use client";

// The bank-transfer add-money panel. It branches on the market's active
// collection method (GET /api/collections/checkout):
//   • "dva"      — a dedicated account number (NUBAN) the user links with their
//                  BVN and then transfers to. Static account, shown here. The
//                  BVN is sent once to create the account, never shown back.
//   • "checkout" — a hosted checkout: the user enters an amount and is taken to
//                  a secure page to pay; their wallet is credited on success.
// Which one is live is a server decision (plug-and-play), so no provider name
// ever appears in the copy below.

import { useEffect, useState } from "react";
import { Landmark, Banknote, Check, Copy, Loader2, ShieldCheck, ArrowUpRight } from "@/components/icons";
import { Button } from "@/components/app/ui";
import { authedFetch, authedPostJson } from "@pesarc/sdk/api/client";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { getActiveChainKey } from "@pesarc/sdk/chain/registry";
import type { LinkedBankAccount } from "@pesarc/sdk/bank";

export default function BankAccountPanel() {
  const [method, setMethod] = useState<"dva" | "checkout" | null>(null);

  useEffect(() => {
    let active = true;
    authedFetch("/api/collections/checkout?currency=NGN")
      .then((r) => r.json())
      .then((j) => active && setMethod(j.method === "checkout" ? "checkout" : "dva"))
      // If method detection fails, fall back to the dedicated-account flow.
      .catch(() => active && setMethod("dva"));
    return () => {
      active = false;
    };
  }, []);

  if (!method) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate py-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Setting up bank transfer…
      </div>
    );
  }

  return method === "checkout" ? <CheckoutPanel /> : <DvaPanel />;
}

/* ----------------------------- hosted checkout ---------------------------- */

function CheckoutPanel() {
  const { mode, authenticated } = useWallet();
  const smart = useSmartWallet();
  const address = mode === "live" && authenticated ? smart.address : undefined;

  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const value = Number(amount);
  const valid = address && value > 0;

  const start = async () => {
    setError("");
    if (!address) {
      setError("Connect your wallet first.");
      return;
    }
    if (!(value > 0)) {
      setError("Enter an amount.");
      return;
    }
    setBusy(true);
    try {
      const res = await authedPostJson("/api/collections/checkout", {
        amount: value,
        currency: "NGN",
        address,
        chainKey: getActiveChainKey() ?? undefined,
      });
      const j = await res.json();
      if (j.ok && j.url) {
        // Hand off to the secure hosted checkout; it returns to /add on finish.
        window.location.assign(j.url as string);
        return;
      }
      setError(j.error ?? "Couldn't start your top-up.");
    } catch {
      setError("Couldn't start your top-up.");
    }
    setBusy(false);
  };

  return (
    <div className="rounded-2xl border border-fog bg-snow p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-full bg-sky-tint text-sky-deep flex items-center justify-center">
          <Banknote className="w-4 h-4" />
        </span>
        <div>
          <div className="text-[14px] font-bold text-ink">Add money</div>
          <div className="text-[12px] text-slate">Pay securely and your balance updates.</div>
        </div>
      </div>
      <p className="text-[12.5px] text-slate mb-3">
        Enter an amount and continue to a secure checkout. Nigeria only for now.
      </p>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-bold text-slate">
          ₦
        </span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          inputMode="decimal"
          placeholder="0"
          aria-label="Amount in naira"
          className="w-full rounded-xl border border-fog bg-white pl-8 pr-3.5 py-2.5 text-[15px] text-ink numerals outline-none focus:border-sky/50"
        />
      </div>
      {error && <p className="text-[12px] text-alert mt-2">{error}</p>}
      <Button block className="mt-3" onClick={start} disabled={busy || !valid}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
        {!address ? "Sign in first" : "Add money"}
      </Button>
      <p className="text-[10.5px] text-slate/70 mt-2 flex items-center gap-1">
        <ShieldCheck className="w-3 h-3" /> You&apos;ll pay on a secure page and return here.
      </p>
    </div>
  );
}

/* --------------------------- dedicated account (DVA) ---------------------- */

function DvaPanel() {
  const [account, setAccount] = useState<LinkedBankAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [bvn, setBvn] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refetch = () =>
    authedFetch("/api/bank")
      .then((r) => r.json())
      .then((j) => setAccount(j.account ?? null))
      .catch(() => {});

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
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
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

  if (account && account.status === "pending") {
    return (
      <div className="rounded-2xl border border-fog bg-snow p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-8 h-8 rounded-full bg-sky-tint text-sky-deep flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
          </span>
          <div>
            <div className="text-[14px] font-bold text-ink">Setting up your account</div>
            <div className="text-[12px] text-slate">We&apos;re assigning your account number.</div>
          </div>
        </div>
        <p className="text-[12.5px] text-slate mb-3">
          This usually takes a moment. Check back shortly.
        </p>
        <Button
          block
          onClick={async () => {
            setRefreshing(true);
            await refetch();
            setRefreshing(false);
          }}
          disabled={refreshing}
        >
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Check status
        </Button>
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
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          inputMode="email"
          placeholder="Email (for statements & receipts)"
          aria-label="Email"
          className="w-full rounded-xl border border-fog bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-sky/50"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          inputMode="tel"
          placeholder="Phone (optional)"
          aria-label="Phone"
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
