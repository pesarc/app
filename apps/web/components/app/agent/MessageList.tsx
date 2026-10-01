"use client";

import { RefObject, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, ExternalLink, Sparkles, BarChart3, FileText, Bot } from "@/components/icons";
import { Card } from "@/components/app/ui";
import type { AgentDraft } from "@pesarc/sdk/agent/run";
import type { Msg } from "./types";
import { UploadPreview } from "./UploadPreview";
import { ConsentCard } from "./ConsentCard";
import { Receipt } from "./Receipt";
import { RichText } from "./RichText";
import { RouteCard } from "./RouteCard";

const DEFAULT_STEPS = ["Reading what you need", "Checking today's rate", "Getting your options ready"];

/** A branded "agent at work" trace: a checklist that ticks through the real
 *  stages of the action (understand, match, settle, pay out), so the user can
 *  watch it work. Steps advance on a cadence and hold on the last until the
 *  result arrives. */
function Thinking({ steps, activeStep }: { steps?: string[]; activeStep?: number }) {
  const list = steps && steps.length ? steps : DEFAULT_STEPS;
  // Server-driven index (SSE) when given; otherwise advance on a local timer.
  const driven = typeof activeStep === "number";
  const [timed, setTimed] = useState(0);
  useEffect(() => {
    if (driven) return;
    setTimed(0);
    const id = setInterval(() => setTimed((n) => Math.min(n + 1, list.length - 1)), 1200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driven, list.join("|")]);
  const i = driven ? Math.min(activeStep!, list.length - 1) : timed;

  return (
    <div className="flex justify-start">
      <Card className="rounded-2xl rounded-bl-sm px-4 py-3 w-full sm:w-auto sm:min-w-[260px]">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky/15 text-sky">
            <Bot className="h-3.5 w-3.5" />
          </span>
          <span className="text-[12px] font-bold text-harbor">Pesarc is on it</span>
        </div>
        <ul className="space-y-1.5">
          {list.map((step, idx) => {
            const done = idx < i;
            const active = idx === i;
            return (
              <li key={idx} className="flex items-center gap-2 text-[13px]">
                <span className="flex w-4 justify-center" aria-hidden>
                  {done ? (
                    <Check className="h-3.5 w-3.5 text-harbor" strokeWidth={2.5} />
                  ) : active ? (
                    <span className="flex gap-0.5">
                      <span className="h-1 w-1 animate-bounce rounded-full bg-sky [animation-delay:-0.2s]" />
                      <span className="h-1 w-1 animate-bounce rounded-full bg-sky [animation-delay:-0.1s]" />
                      <span className="h-1 w-1 animate-bounce rounded-full bg-sky" />
                    </span>
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-slate/25" />
                  )}
                </span>
                <span
                  className={
                    done
                      ? "text-slate"
                      : active
                        ? "font-semibold text-ink"
                        : "text-slate/40"
                  }
                >
                  {step}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

export function MessageList({
  msgs,
  busy,
  thinking,
  thinkingStep,
  endRef,
  onConfirm,
  onDecline,
}: {
  msgs: Msg[];
  busy: boolean;
  thinking?: string[];
  thinkingStep?: number;
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
                <RichText text={m.text} />

                {m.draft && (
                  <ConsentCard
                    draft={m.draft}
                    state={m.draftState}
                    busy={busy}
                    onConfirm={() => onConfirm(i, m.draft!)}
                    onCancel={() => onDecline(i)}
                  />
                )}

                {m.route && <RouteCard plan={m.route} />}

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
                {m.crossChainUrl && (
                  <Link
                    href={m.crossChainUrl}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-sky text-white text-xs font-bold px-3 py-1.5 hover:-translate-y-0.5 transition-transform"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Open Cross-chain
                  </Link>
                )}
                {m.upload && <UploadPreview upload={m.upload} />}
              </Card>
            </div>
          </motion.div>
        ),
      )}
      {busy && <Thinking steps={thinking} activeStep={thinkingStep} />}
      <div ref={endRef} />
    </div>
  );
}
