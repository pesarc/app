"use client";

import Link from "next/link";
import { FileText, AlertCircle, ArrowRight } from "@/components/icons";
import type { ParsedUpload } from "@pesarc/sdk/agent/files";
import { sendHref } from "./helpers";

export function UploadPreview({ upload }: { upload: ParsedUpload }) {
  const totals = Object.entries(upload.totals);
  const flagged = upload.rows.filter((r) => r.issues?.length).length;
  return (
    <div className="mt-3 rounded-xl border border-fog bg-snow overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-fog bg-black/[0.02]">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-slate">
          <FileText className="w-3.5 h-3.5" /> {upload.rowCount} recipient{upload.rowCount === 1 ? "" : "s"}
        </span>
        <span className="text-[13px] font-bold text-harbor numerals">
          {totals.map(([c, v]) => `${c} ${Math.round(v).toLocaleString()}`).join(" · ")}
        </span>
      </div>

      {upload.warnings.length > 0 && (
        <div className="px-3.5 py-2 border-b border-fog space-y-1">
          {upload.warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-1.5 text-[12px] text-alert">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {w}
            </p>
          ))}
        </div>
      )}

      <ul className="max-h-64 overflow-y-auto divide-y divide-fog">
        {upload.rows.map((r, i) => {
          const bad = Boolean(r.issues?.length);
          return (
            <li key={i} className="flex items-center gap-3 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px] font-semibold text-ink truncate">{r.name || r.handle}</span>
                  {bad && <AlertCircle className="w-3.5 h-3.5 text-alert shrink-0" />}
                </div>
                <div className="text-[12px] text-slate truncate">
                  {r.method === "mobile_money" ? "Mobile money" : r.method === "bank" ? "Bank" : "Needs a destination"}
                  {r.name ? ` · ${r.handle}` : ""}
                  {r.issues?.length ? ` · ${r.issues[0]}` : ""}
                </div>
              </div>
              <span className="text-[13.5px] font-bold text-harbor numerals shrink-0">
                {r.currency} {Math.round(r.amount).toLocaleString()}
              </span>
              <Link
                href={sendHref(r)}
                aria-label={`Confirm and send to ${r.name || r.handle}`}
                className="inline-flex items-center gap-1 rounded-full bg-sky text-white text-[12px] font-bold px-3 py-1.5 shrink-0 hover:-translate-y-0.5 transition-transform"
              >
                Confirm <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="px-3.5 py-2.5 text-[11.5px] text-slate border-t border-fog bg-black/[0.02]">
        I drafted this from your file. Nothing is sent, each “Confirm” opens Send so you approve
        and settle it yourself{flagged ? `. ${flagged} row${flagged === 1 ? "" : "s"} need a detail fixed first` : ""}.
      </p>
    </div>
  );
}
