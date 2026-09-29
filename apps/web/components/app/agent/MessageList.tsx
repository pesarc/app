"use client";

import { RefObject } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Check,
  ExternalLink,
  Loader2,
  Sparkles,
  BarChart3,
  FileText,
} from "@/components/icons";
import { Card } from "@/components/app/ui";
import type { Msg } from "./types";
import { UploadPreview } from "./UploadPreview";

export function MessageList({
  msgs,
  busy,
  endRef,
}: {
  msgs: Msg[];
  busy: boolean;
  endRef: RefObject<HTMLDivElement>;
}) {
  return (
    <div className="space-y-3 mb-4">
      {msgs.map((m, i) =>
        m.role === "user" ? (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex justify-end"
          >
            <div className="bg-sky text-white rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[85%] text-[15px]">
              {m.attachment && (
                <span className="mb-1.5 flex items-center gap-1.5 rounded-lg bg-white/15 px-2 py-1 text-[13px] font-medium">
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{m.attachment}</span>
                </span>
              )}
              {m.text}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex justify-start"
          >
            <div className="max-w-[90%]">
              <Card className="rounded-2xl rounded-bl-sm px-4 py-3 text-[15px] text-ink">
                {m.text}
                {(m.submitUrl || m.settlements?.length) && (
                  <div className="mt-2.5 pt-2.5 border-t border-black/[0.06] space-y-1.5">
                    {m.matched && (
                      <div className="flex items-center gap-1.5 text-xs text-sky font-medium">
                        <Check className="w-3.5 h-3.5" /> Matched with someone sending the other way
                      </div>
                    )}
                    {m.pending && (
                      <div className="flex items-center gap-1.5 text-xs text-harbor font-medium">
                        <Sparkles className="w-3.5 h-3.5" /> Finding a match
                      </div>
                    )}
                    {m.submitUrl && (
                      <a
                        href={m.submitUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-sky hover:underline"
                      >
                        View proof <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {m.settlements?.map((s, j) => (
                      <a
                        key={j}
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-xs text-sky hover:underline"
                      >
                        Settlement ({s.kind}) <ExternalLink className="w-3 h-3 inline" />
                      </a>
                    ))}
                  </div>
                )}
                {m.marketsUrl && (
                  <Link
                    href={m.marketsUrl}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-sky text-white text-xs font-bold px-3 py-1.5 hover:-translate-y-0.5 transition-transform"
                  >
                    <BarChart3 className="w-3.5 h-3.5" /> Open Markets
                  </Link>
                )}
                {m.billsUrl && (
                  <Link
                    href={m.billsUrl}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-sky text-white text-xs font-bold px-3 py-1.5 hover:-translate-y-0.5 transition-transform"
                  >
                    <Check className="w-3.5 h-3.5" /> Open Bills
                  </Link>
                )}
                {m.upload && <UploadPreview upload={m.upload} />}
              </Card>
            </div>
          </motion.div>
        ),
      )}
      {busy && (
        <div className="flex justify-start">
          <Card className="rounded-2xl rounded-bl-sm px-4 py-3">
            <Loader2 className="w-4 h-4 animate-spin text-sky" />
          </Card>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
