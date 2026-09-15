"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Info, Check } from "lucide-react";
import { Button } from "@/components/app/ui";
import { type Market } from "@pesarc/sdk/markets";
import { type Side } from "./display";
import { spring } from "@/components/motion";

export default function StakeSheet({
  market,
  side,
  prices,
  onClose,
}: {
  market: Market;
  side: Side;
  prices: { yes: number; no: number };
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [done, setDone] = useState(false);

  const price = side === "yes" ? prices.yes : prices.no;
  const stake = Number(amount) || 0;
  // Parimutuel: your real share is stake / winning-pool. We show a simple
  // implied return from the current price (illustrative, mock-only).
  const impliedPayout = price > 0 ? (stake * 100) / price : 0;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="w-full sm:max-w-sm bg-cream rounded-t-3xl sm:rounded-3xl p-5 shadow-card-flat border border-fog"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 40, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={spring}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted">
              {side === "yes" ? "Backing Yes" : "Backing No"} · {price}¢
            </div>
            <p className="font-semibold text-deepink leading-snug mt-1">
              {market.question}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-deepink p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="py-6 text-center">
            <span className="inline-flex w-12 h-12 rounded-full bg-emerald/15 items-center justify-center text-emerald mb-3">
              <Check className="w-6 h-6" />
            </span>
            <p className="font-semibold text-deepink">
              {side === "yes" ? "Yes" : "No"} position placed
            </p>
            <p className="text-sm text-muted mt-1">
              {market.collateral} {stake.toLocaleString()} staked · settles{" "}
              {market.resolves} from{" "}
              {market.resolver.kind === "oracle"
                ? "the realized rate"
                : "an attested print"}
              .
            </p>
            <Button block className="mt-5" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <label className="block text-xs font-medium text-muted mb-1.5">
              Amount ({market.collateral})
            </label>
            <div className="flex items-center rounded-xl border border-black/10 bg-white px-4 py-3 mb-2">
              <span className="text-muted mr-2 text-sm">{market.collateral}</span>
              <input
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0"
                className="flex-1 bg-transparent outline-none text-xl font-semibold text-deepink numerals"
              />
            </div>

            <div className="flex gap-2 mb-4">
              {[5000, 20000, 50000].map((q) => (
                <button
                  key={q}
                  onClick={() => setAmount(String(q))}
                  className="flex-1 rounded-lg bg-black/[0.04] hover:bg-black/[0.07] py-1.5 text-xs font-medium text-deepink transition-colors"
                >
                  {q.toLocaleString()}
                </button>
              ))}
            </div>

            <div className="rounded-xl bg-black/[0.03] p-3 text-sm space-y-1.5 mb-4">
              <Row label="Price" value={`${price}¢ per ${market.collateral} 1`} />
              <Row
                label="Max payout if right"
                value={`${market.collateral} ${Math.round(
                  impliedPayout
                ).toLocaleString()}`}
                accent
              />
              <Row label="Settles" value={market.resolves} />
            </div>

            {market.hedge && (
              <p className="flex items-start gap-2 text-[11px] text-muted mb-4">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald" />
                This is a hedge, not a bet — it pays out to offset the real-world
                move, in your own currency.
              </p>
            )}

            <Button
              block
              size="lg"
              disabled={stake <= 0}
              onClick={() => setDone(true)}
            >
              {stake > 0
                ? `Stake ${market.collateral} ${stake.toLocaleString()} on ${
                    side === "yes" ? "Yes" : "No"
                  }`
                : "Enter an amount"}
            </Button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span
        className={`font-semibold numerals ${
          accent ? "text-emerald" : "text-deepink"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
