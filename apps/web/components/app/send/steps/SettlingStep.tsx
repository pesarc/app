"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check } from "@/components/icons";
import { type Recipient } from "@pesarc/sdk/account";
import { formatMoney } from "@pesarc/sdk/money";
import { PAYOUT_METHODS, type Quote } from "@pesarc/sdk/quote";
import { Button } from "@/components/app/ui";
import type { SendResult } from "../types";

export function SettlingStep({
  recipient,
  quote,
  executeReal,
  mustBeReal,
  blockReason,
  onDone,
  onCancel,
}: {
  recipient: Recipient;
  quote: Quote;
  /** When present, performs a real gasless on-chain send. */
  executeReal?: () => Promise<SendResult>;
  /** True when this send MUST settle on-chain (real wallet, live account): if it
   *  can't, show why — never animate a simulated "sent". */
  mustBeReal?: boolean;
  /** Why a must-be-real send can't run live (shown instead of a fake success). */
  blockReason?: string;
  onDone: (result?: SendResult) => void;
  /** Called when a real send fails — the user goes back, nothing is "sent". */
  onCancel: () => void;
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
  const [error, setError] = useState<string | null>(null);

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
        .catch((e: unknown) => {
          // A real send failed — surface it, never fake success. Funds stay put.
          if (cancelled) return;
          const msg =
            (e as { shortMessage?: string; message?: string })?.shortMessage ||
            (e as Error)?.message ||
            "That transfer didn't go through.";
          setError(msg);
        });
    } else if (mustBeReal) {
      // A real wallet send on a live account that can't execute: say why. NEVER
      // animate a success — the money would not have moved.
      setError(
        blockReason ||
          "This send can't settle on-chain right now, so nothing was sent.",
      );
    } else {
      // Mock/demo account only (no real wallet): animate a simulated send.
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

  if (error) {
    return (
      <div className="py-10 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-alert/10 flex items-center justify-center mb-5">
          <AlertCircle className="w-8 h-8 text-alert" />
        </div>
        <h1 className="text-xl font-semibold text-ink mb-1">Transfer didn&apos;t go through</h1>
        <p className="text-slate text-sm mb-1">Nothing was sent — your balance is unchanged.</p>
        <p className="text-slate text-[13px] mb-7 px-6 break-words">{error}</p>
        <Button size="lg" block onClick={onCancel}>
          Go back
        </Button>
      </div>
    );
  }

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
