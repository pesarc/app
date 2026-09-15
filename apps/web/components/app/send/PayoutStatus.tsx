"use client";

// Live fiat-payout tracker: polls the payout orchestrator until the sandbox
// ramp partner reports the NGN payout as paid.

import { useEffect, useState } from "react";
import { Banknote, Check, Loader2, Smartphone } from "lucide-react";
import { authedFetch } from "@pesarc/sdk/api/client";

type Status = "initiated" | "processing" | "paid";

const LABELS: Record<Status, string> = {
  initiated: "Payout initiated",
  processing: "Partner processing",
  paid: "Paid out",
};

export function PayoutStatus({
  reference,
  method,
}: {
  reference: string;
  method: "bank" | "mobile_money";
}) {
  const [status, setStatus] = useState<Status>("initiated");
  const [partnerRef, setPartnerRef] = useState<string>();

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await authedFetch(`/api/payouts?ref=${encodeURIComponent(reference)}`);
        const data = await res.json();
        if (active && data.ok) {
          setStatus(data.payout.status as Status);
          setPartnerRef(data.payout.partnerRef);
          if (data.payout.status === "paid") return; // stop polling
        }
      } catch {
        /* keep last status */
      }
      if (active) timer = setTimeout(poll, 4000);
    };
    let timer = setTimeout(poll, 1500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [reference]);

  const Icon = method === "bank" ? Banknote : Smartphone;
  const paid = status === "paid";

  return (
    <div
      className={`flex items-center gap-2.5 rounded-field px-3.5 py-2.5 text-sm ${
        paid ? "bg-emerald-50 text-emerald" : "bg-black/[0.04] text-deepink"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="font-medium flex-1">
        {method === "bank" ? "Bank transfer" : "Mobile money"} ·{" "}
        {LABELS[status]}
        {partnerRef && paid && (
          <span className="font-mono text-xs opacity-70"> · {partnerRef}</span>
        )}
      </span>
      {paid ? (
        <Check className="w-4 h-4 shrink-0" />
      ) : (
        <Loader2 className="w-4 h-4 animate-spin shrink-0 opacity-60" />
      )}
    </div>
  );
}
