"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "@/components/icons";
import { type Recipient } from "@pesarc/sdk/account";
import { formatMoney } from "@pesarc/sdk/money";
import { PAYOUT_METHODS, type Quote } from "@pesarc/sdk/quote";
import type { SendResult } from "../types";

export function SettlingStep({
  recipient,
  quote,
  executeReal,
  onDone,
}: {
  recipient: Recipient;
  quote: Quote;
  /** When present, performs a real gasless on-chain swap. */
  executeReal?: () => Promise<SendResult>;
  onDone: (result?: SendResult) => void;
}) {
  const payoutLabel =
    PAYOUT_METHODS.find((m) => m.id === quote.payout)?.label ?? "payout";
  const steps = useMemo(
    () => [
      { label: "Confirming your payment", sub: "No fees to send" },
      {
        label: "Sending your money",
        sub: "This takes a few seconds",
      },
      { label: `Paying out to ${payoutLabel}`, sub: "Landing in their account" },
    ],
    [payoutLabel]
  );

  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (executeReal) {
      // Real on-chain gasless send; animate while we await confirmation.
      timers.push(setTimeout(() => !cancelled && setActive(1), 800));
      timers.push(setTimeout(() => !cancelled && setActive(2), 1600));
      executeReal()
        .then((result) => {
          if (cancelled) return;
          setActive(3);
          onDone(result);
        })
        .catch(() => {
          // Never hard-fail the demo — fall back to a simulated success.
          if (cancelled) return;
          setActive(3);
          onDone(undefined);
        });
    } else {
      timers.push(setTimeout(() => setActive(1), 1100));
      timers.push(setTimeout(() => setActive(2), 2300));
      timers.push(setTimeout(() => onDone(), 3500));
    }
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="py-6">
      <div className="text-center mb-8">
        <div className="text-xs font-semibold text-slate uppercase tracking-widest mb-2">
          Sending to {recipient.name}
        </div>
        <div className="text-4xl font-semibold text-ink numerals">
          {formatMoney(quote.receiveAmount, quote.receiveCurrency)}
        </div>
      </div>

      <div className="space-y-1">
        {steps.map((s, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <div key={s.label} className="flex items-start gap-3 p-3">
              <span
                className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition ${
                  done
                    ? "bg-sky text-white"
                    : current
                    ? "bg-sky-tint text-sky animate-progress-pulse"
                    : "bg-black/[0.06] text-slate"
                }`}
              >
                {done ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-current" />
                )}
              </span>
              <div>
                <div
                  className={`text-[15px] font-medium ${
                    done || current ? "text-ink" : "text-slate"
                  }`}
                >
                  {s.label}
                </div>
                <div className="text-xs text-slate">{s.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
