"use client";

// The PAYOUT bank — the real bank account the agent (and the cash-out flow) send
// money TO. Distinct from the deposit DVA in BankAccountPanel (money in). Reuses
// the Send flow's bank picker + account-name resolution, and saves the bank code
// + NUBAN so a real Paystack transfer can run. Set once; the agent's confirm-gated
// cash-out reuses it — the agent never needs to ask for your bank each time.

import { useEffect, useState } from "react";
import { Landmark, Check, Loader2 } from "@/components/icons";
import { Button } from "@/components/app/ui";
import { authedFetch } from "@pesarc/sdk/api/client";
import BankDetails, { type BankDestination } from "@/components/app/send/BankDetails";

type SavedPayout = { bankCode: string; accountNumber: string; accountName: string };

export default function PayoutBankPanel() {
  const [saved, setSaved] = useState<SavedPayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [dest, setDest] = useState<BankDestination | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    authedFetch("/api/bank")
      .then((r) => r.json())
      .then((j) => active && setSaved(j.payoutBank ?? null))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    if (!dest) return;
    setError("");
    setBusy(true);
    try {
      const res = await authedFetch("/api/bank", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankCode: dest.bankCode,
          accountNumber: dest.accountNumber,
          accountName: dest.accountName ?? "Account holder",
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setSaved({ bankCode: dest.bankCode, accountNumber: dest.accountNumber, accountName: dest.accountName ?? "Account holder" });
        setEditing(false);
        setDest(null);
      } else {
        setError(j.error ?? "Could not save your payout bank.");
      }
    } catch {
      setError("Could not save your payout bank.");
    }
    setBusy(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate py-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Checking your payout bank…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-fog bg-snow p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-full bg-sky-tint text-sky-deep flex items-center justify-center">
          <Landmark className="w-4 h-4" />
        </span>
        <div>
          <div className="text-[14px] font-bold text-ink">Payout bank</div>
          <div className="text-[12px] text-slate">Where cash-outs are sent. The agent reuses this.</div>
        </div>
      </div>

      {saved && !editing ? (
        <>
          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-black/[0.03] px-3.5 py-3">
            <div>
              <div className="text-[17px] font-extrabold text-ink numerals tracking-wide">{saved.accountNumber}</div>
              <div className="text-[12px] text-slate">{saved.accountName}</div>
            </div>
            <Check className="w-4 h-4 text-sky-deep shrink-0" />
          </div>
          <Button variant="secondary" block className="mt-3" onClick={() => setEditing(true)}>
            Change payout bank
          </Button>
        </>
      ) : (
        <>
          <p className="text-[12.5px] text-slate mt-1 mb-2">
            Pick your bank and enter your account number — we verify the name before saving.
          </p>
          <BankDetails onChange={setDest} />
          {error && <p className="text-[12px] text-alert mt-2">{error}</p>}
          <Button block className="mt-3" onClick={save} disabled={busy || !dest}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save payout bank
          </Button>
        </>
      )}
    </div>
  );
}
