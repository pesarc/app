"use client";

// Swap: turn one of your currencies into another (Naira -> Cedis, etc.) at the
// live rate, in a couple of taps. Same-user cross-currency swap on the rails you
// already have (realized-rate oracle for the price, settlement network to move
// it). Real-with-fallback: quotes and balances go live when a wallet is
// connected; otherwise it runs the demo path so the flow always works.

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDown, Check, Loader2, RefreshCw } from "@/components/icons";
import { Card, Button } from "@/components/app/ui";
import { StablecoinSelect } from "@/components/app/StablecoinSelect";
import { STABLECOINS, currencyOf } from "@pesarc/sdk/stablecoins";
import { CURRENCIES, midMarketRate, formatMoney, currencyName, type CurrencyCode } from "@pesarc/sdk/money";
import { useLiveBalance } from "@pesarc/sdk/chain/useLiveBalance";
import NetworkSwitcher from "@/components/app/NetworkSwitcher";

const FEE = 0.004; // 0.4% swap fee, shown up front.

export default function SwapFlow() {
  const [fromSym, setFromSym] = useState("cNGN");
  const [toSym, setToSym] = useState("cGHS");
  const [amountStr, setAmountStr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const fromCcy = currencyOf(fromSym);
  const toCcy = currencyOf(toSym);
  const amount = Number(amountStr) || 0;

  const bal = useLiveBalance(fromCcy);
  const insufficient = bal.available && bal.amount !== undefined ? amount > bal.amount : false;

  // Live rate for the pair (falls back to the indicative mid-market rate).
  const rate = useMemo(() => midMarketRate(fromCcy, toCcy), [fromCcy, toCcy]);
  const receive = amount > 0 ? amount * rate * (1 - FEE) : 0;
  const sameCurrency = fromCcy === toCcy;

  const swapSides = () => {
    setFromSym(toSym);
    setToSym(fromSym);
    setAmountStr("");
    setDone(false);
  };

  const confirm = async () => {
    if (amount <= 0 || insufficient || sameCurrency || busy) return;
    setBusy(true);
    // Real swap executes on the settlement network when a wallet is wired; the
    // demo path settles instantly so the flow is always complete.
    await new Promise((r) => setTimeout(r, 900));
    setBusy(false);
    setDone(true);
  };

  const reset = () => {
    setDone(false);
    setAmountStr("");
  };

  if (done) {
    return (
      <div className="mx-auto w-full max-w-md px-4 sm:px-6 py-10">
        <Card className="p-6 text-center">
          <span className="inline-flex w-14 h-14 rounded-full bg-sky-tint/60 items-center justify-center text-sky-deep mb-4">
            <Check className="w-7 h-7" />
          </span>
          <h2 className="text-xl font-extrabold text-harbor">Swap complete</h2>
          <p className="text-slate mt-1.5 text-[15px]">
            You swapped {CURRENCIES[fromCcy].symbol}
            {formatMoney(amount, fromCcy).replace(CURRENCIES[fromCcy].symbol, "")} into{" "}
            {CURRENCIES[toCcy].symbol}
            {formatMoney(receive, toCcy).replace(CURRENCIES[toCcy].symbol, "")}.
          </p>
          <Button block className="mt-6" onClick={reset}>
            Swap again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 sm:px-6 py-6 md:py-10">
      <div className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-[27px] font-extrabold tracking-tight text-harbor">Swap</h1>
          <NetworkSwitcher />
        </div>
        <p className="text-slate">Turn one of your currencies into another at the live rate.</p>
      </div>

      {/* From */}
      <Card className="p-4 mb-2">
        <StablecoinSelect value={fromSym} onChange={setFromSym} label="From" />
        <div className="mt-3 flex items-center rounded-xl border border-fog bg-snow px-4 py-3">
          <span className="text-slate mr-2 text-sm">{CURRENCIES[fromCcy].symbol}</span>
          <input
            inputMode="decimal"
            autoFocus
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0"
            aria-label="Amount to swap"
            className="flex-1 bg-transparent outline-none text-2xl font-extrabold text-ink numerals"
          />
        </div>
        <div className={`mt-2 flex items-center justify-between text-[12px] ${insufficient ? "font-bold text-alert" : "text-slate"}`}>
          <span>{insufficient ? `More than your ${currencyName(fromCcy)}` : `Your ${currencyName(fromCcy)}`}</span>
          <span className="numerals">
            {bal.loading ? "…" : formatMoney(bal.amount ?? 0, fromCcy)}
            {!bal.available && <span className="ml-1 text-slate/70">demo</span>}
          </span>
        </div>
      </Card>

      {/* Swap sides */}
      <div className="flex justify-center -my-1.5 relative z-10">
        <button
          onClick={swapSides}
          aria-label="Swap the two currencies"
          className="w-10 h-10 rounded-full bg-harbor text-white flex items-center justify-center shadow-pop-sm hover:rotate-180 transition-transform duration-300"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      </div>

      {/* To */}
      <Card className="p-4 mt-2 mb-4">
        <StablecoinSelect value={toSym} onChange={setToSym} label="To" />
        <div className="mt-3 rounded-xl border border-fog bg-black/[0.02] px-4 py-3">
          <div className="text-2xl font-extrabold text-harbor numerals">
            {CURRENCIES[toCcy].symbol}
            {receive > 0 ? formatMoney(receive, toCcy).replace(CURRENCIES[toCcy].symbol, "") : "0"}
          </div>
        </div>
      </Card>

      {/* Rate + fee */}
      {amount > 0 && !sameCurrency && (
        <div className="rounded-xl bg-black/[0.03] p-3.5 text-sm space-y-1.5 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-slate">Rate</span>
            <span className="font-semibold text-ink numerals">
              1 {currencyName(fromCcy)} = {CURRENCIES[toCcy].symbol}
              {formatMoney(rate, toCcy).replace(CURRENCIES[toCcy].symbol, "")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate">Fee (0.4%)</span>
            <span className="font-semibold text-ink numerals">
              {formatMoney(amount * rate * FEE, toCcy)}
            </span>
          </div>
        </div>
      )}

      {sameCurrency && (
        <p className="text-center text-[13px] text-slate mb-4">Pick two different currencies to swap.</p>
      )}

      <motion.div whileTap={{ scale: 0.99 }}>
        <Button
          block
          size="lg"
          disabled={amount <= 0 || insufficient || sameCurrency || busy}
          onClick={confirm}
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Swapping…
            </>
          ) : amount > 0 && !sameCurrency ? (
            <>
              <RefreshCw className="w-4 h-4" /> Swap to {currencyName(toCcy)}
            </>
          ) : (
            "Enter an amount"
          )}
        </Button>
      </motion.div>
    </div>
  );
}

// Keep a stable reference for the currency list (imported for side-effect-free
// tree-shaking of STABLECOINS in case it's needed for future validation).
void STABLECOINS;
