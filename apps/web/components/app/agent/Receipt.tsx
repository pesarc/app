"use client";

// The receipt the user gets once a drafted action is done. A clean, shareable
// record: what happened, the amounts, a reference, the transaction hash, a proof
// link, and a one-tap Download as a branded PNG.

import { useState } from "react";
import { Check, Clock, Copy, Download, ExternalLink } from "@/components/icons";
import type { AgentReceipt } from "@pesarc/sdk/agent/run";
import { downloadReceipt } from "./receiptImage";

const short = (h: string) => (h.length > 16 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h);

function CopyLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — ignore */
    }
  };
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1 font-mono text-[11px] text-slate hover:text-ink transition-colors"
      title={`Copy ${label}`}
    >
      <span className="text-slate/70">{label}</span> {short(value)}
      {copied ? <Check className="w-3 h-3 text-harbor" /> : <Copy className="w-3 h-3 opacity-60" />}
    </button>
  );
}

export function Receipt({ receipt }: { receipt: AgentReceipt }) {
  const pending = receipt.status === "pending";
  const accent = pending ? "#a97b12" : "#0f8a6b";
  const tint = pending ? "rgba(224,168,46,0.14)" : "rgba(15,138,107,0.12)";
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await downloadReceipt(receipt);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-2xl border border-fog bg-snow overflow-hidden shadow-card-flat">
      <div className="h-1" style={{ backgroundColor: accent }} />
      <div className="px-4 pt-3.5 pb-3 flex items-center gap-3">
        <span
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: tint, color: accent }}
        >
          {pending ? <Clock className="w-[18px] h-[18px]" /> : <Check className="w-[18px] h-[18px]" strokeWidth={2.5} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-extrabold text-harbor truncate">{receipt.title}</div>
          <div className="text-[12px] font-semibold" style={{ color: accent }}>
            {pending ? "Matching, settles automatically" : "Completed"}
          </div>
        </div>
      </div>

      {/* perforated divider */}
      <div className="mx-4 border-t border-dashed border-black/[0.12]" />

      <div className="px-4 py-3 space-y-1.5">
        {receipt.lines.map((l) => (
          <div key={l.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate">{l.label}</span>
            <span className="font-bold text-ink numerals text-right">{l.value}</span>
          </div>
        ))}
      </div>

      {(receipt.reference || receipt.txHash) && (
        <div className="px-4 pb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {receipt.reference && <CopyLine label="Ref" value={receipt.reference} />}
          {receipt.txHash && <CopyLine label="Tx" value={receipt.txHash} />}
        </div>
      )}

      <div className="mx-4 border-t border-black/[0.06]" />
      <div className="px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 text-[12px] font-bold text-harbor hover:text-ink transition-colors disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" /> {saving ? "Preparing…" : "Download receipt"}
        </button>
        {receipt.proofUrl && (
          <a
            href={receipt.proofUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-sky hover:underline"
          >
            View proof <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {receipt.settlements?.map((s, i) => (
          <a
            key={i}
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-sky hover:underline"
          >
            Settlement ({s.kind}) <ExternalLink className="w-3 h-3" />
          </a>
        ))}
      </div>
    </div>
  );
}
