"use client";

import { RefObject, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, ExternalLink, Sparkles, BarChart3, FileText } from "@/components/icons";
import { Card } from "@/components/app/ui";
import type { AgentDraft } from "@pesarc/sdk/agent/run";
import type { Msg } from "./types";
import { UploadPreview } from "./UploadPreview";
import { ConsentCard } from "./ConsentCard";
import { Receipt } from "./Receipt";

const THINKING_STEPS = [
  "Reading your request",
  "Checking the live rate",
  "Preparing it for you",
];

/** A calm "thinking" indicator that steps through what the agent is doing. */
function Thinking() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => Math.min(n + 1, THINKING_STEPS.length - 1)), 1100);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex justify-start">
      <Card className="rounded-2xl rounded-bl-sm px-4 py-3 inline-flex items-center gap-2.5">
        <span className="flex gap-1" aria-hidden>
          <span className="w-1.5 h-1.5 rounded-full bg-sky animate-bounce [animation-delay:-0.2s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-sky animate-bounce [animation-delay:-0.1s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-sky animate-bounce" />
        </span>
        <span className="text-[13.5px] font-medium text-slate">{THINKING_STEPS[i]}…</span>
      </Card>
    </div>
  );
}

export function MessageList({
  msgs,
  busy,
  endRef,
  onConfirm,
  onDecline,
}: {
  msgs: Msg[];
  busy: boolean;
  endRef: RefObject<HTMLDivElement>;
  onConfirm: (index: number, draft: AgentDraft) => void;
  onDecline: (index: number) => void;
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
            <div className="max-w-[90%] w-full sm:w-auto">
              <Card className="rounded-2xl rounded-bl-sm px-4 py-3 text-[15px] text-ink">
                {m.text}

                {m.draft && (
                  <ConsentCard
                    draft={m.draft}
                    state={m.draftState}
                    busy={busy}
                    onConfirm={() => onConfirm(i, m.draft!)}
                    onCancel={() => onDecline(i)}
                  />
                )}

                {m.receipt && <Receipt receipt={m.receipt} />}

                {/* Proof / settlement links for a completed action without a
                    receipt card (e.g. a market or a legacy result). */}
                {!m.receipt && (m.submitUrl || m.settlements?.length) && (
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
                {m.billsUrl && !m.receipt && (
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
      {busy && <Thinking />}
      <div ref={endRef} />
    </div>
  );
}
