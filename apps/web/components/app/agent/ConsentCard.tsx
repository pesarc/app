"use client";

// The agent never moves money without a yes. When it drafts a transfer or a
// bill, it shows this card: exactly what it will do, in plain money words, with
// one clear Confirm and a Cancel. Nothing is sent until Confirm is tapped.

import { ShieldCheck, Check, X, Loader2 } from "@/components/icons";
import type { AgentDraft } from "@pesarc/sdk/agent/run";

function lines(draft: AgentDraft): { label: string; value: string }[] {
  if (draft.type === "transfer") {
    const out: { label: string; value: string }[] = [
      { label: "You send", value: `${draft.fromFlag} ${draft.amount.toLocaleString()} ${draft.fromCode}` },
    ];
    if (draft.receiveAmount > 0)
      out.push({
        label: "They receive",
        value: `${draft.toFlag} ${draft.receiveAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${draft.toCode}`,
      });
    if (draft.recipient) out.push({ label: "To", value: `${draft.recipient.slice(0, 6)}…${draft.recipient.slice(-4)}` });
    out.push({ label: "Network", value: draft.chainLabel });
    return out;
  }
  const out: { label: string; value: string }[] = [
    { label: draft.category === "electricity" ? "Meter" : "To", value: draft.customer },
  ];
  if (draft.amount) out.push({ label: "Amount", value: `₦${draft.amount.toLocaleString()}` });
  return out;
}

export function ConsentCard({
  draft,
  state,
  busy,
  onConfirm,
  onCancel,
}: {
  draft: AgentDraft;
  state?: "pending" | "confirmed" | "cancelled";
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const title = draft.type === "transfer" ? "Confirm this transfer" : `Confirm this ${draft.category}`;
  return (
    <div className="mt-3 rounded-2xl border border-sky/30 bg-sky-tint/25 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-sky/20">
        <ShieldCheck className="w-4 h-4 text-sky" />
        <span className="text-[13px] font-bold text-harbor">{title}</span>
      </div>
      <div className="px-4 py-3 space-y-1.5">
        {lines(draft).map((l) => (
          <div key={l.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate">{l.label}</span>
            <span className="font-bold text-ink numerals text-right">{l.value}</span>
          </div>
        ))}
      </div>
      {state === "cancelled" ? (
        <div className="px-4 py-2.5 border-t border-sky/20 text-[13px] font-semibold text-slate">
          Cancelled. Nothing was sent.
        </div>
      ) : state === "confirmed" ? (
        <div className="px-4 py-2.5 border-t border-sky/20 flex items-center gap-1.5 text-[13px] font-semibold text-sky-deep">
          <Check className="w-4 h-4" /> Confirmed
        </div>
      ) : (
        <div className="px-3 py-3 border-t border-sky/20 flex gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-fog bg-snow px-3 py-2.5 text-sm font-bold text-slate hover:text-ink transition disabled:opacity-40"
          >
            <X className="w-4 h-4" /> Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-[1.4] inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky text-white px-3 py-2.5 text-sm font-extrabold hover:-translate-y-0.5 transition-transform disabled:opacity-40 disabled:translate-y-0"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {draft.type === "transfer" ? "Confirm & send" : "Confirm & pay"}
          </button>
        </div>
      )}
    </div>
  );
}
