"use client";

// The receipt the user gets once a drafted action is done. A clean, shareable
// record: what happened, the amounts, a reference, and a one-tap proof link.

import { Check, Clock, ExternalLink } from "@/components/icons";
import type { AgentReceipt } from "@pesarc/sdk/agent/run";

export function Receipt({ receipt }: { receipt: AgentReceipt }) {
  const pending = receipt.status === "pending";
  const accent = pending ? "#a97b12" : "#0f8a6b";
  const tint = pending ? "rgba(224,168,46,0.14)" : "rgba(15,138,107,0.12)";
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

      {(receipt.reference || receipt.proofUrl || receipt.settlements?.length) && (
        <div className="px-4 pb-3.5 pt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {receipt.reference && (
            <span className="font-mono text-[11px] text-slate">Ref {receipt.reference}</span>
          )}
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
      )}
    </div>
  );
}
