"use client";

// Swap: turn one of your currencies into another (Naira -> Cedis, etc.). Same-user
// cross-currency swap on the rails you already have. The price is the REAL
// realized-rate oracle rate for the corridor when it is live on the active chain;
// otherwise it shows the indicative mid-market rate, clearly tagged "indicative".
// Balances go live when a wallet is connected; otherwise the demo path runs so the
// flow is always complete.

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowDown, Check, Loader2, RefreshCw } from "@/components/icons";
import { Card, Button } from "@/components/app/ui";
import { StablecoinSelect } from "@/components/app/StablecoinSelect";
import { STABLECOINS, currencyOf } from "@pesarc/sdk/stablecoins";
import { CURRENCIES, formatMoney, currencyName, type CurrencyCode } from "@pesarc/sdk/money";
import { useLiveBalance } from "@pesarc/sdk/chain/useLiveBalance";
import { useActiveEvmChain } from "@pesarc/sdk/chain/activeChain";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { tokenByCode } from "@pesarc/sdk/chain/evm-settle";
import { explorerTxUrl } from "@pesarc/sdk/chain/chains";
import { evmSwap } from "@pesarc/sdk/swap-write";
import { useCorridorRate } from "@/components/app/useCorridorRate";
import { ExternalLink } from "@/components/icons";
import NetworkSwitcher from "@/components/app/NetworkSwitcher";

const FEE = 0.004; // 0.4% swap fee, shown up front.

export default function SwapFlow() {
  const [fromSym, setFromSym] = useState("cNGN");
  const [toSym, setToSym] = useState("cGHS");
  const [amountStr, setAmountStr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  const fromCcy = currencyOf(fromSym);
  const toCcy = currencyOf(toSym);
  const amount = Number(amountStr) || 0;

  const { chain } = useActiveEvmChain();
  const smart = useSmartWallet();
  const bal = useLiveBalance(fromCcy);
  const insufficient = bal.available && bal.amount !== undefined ? amount > bal.amount : false;

  // Real oracle rate for the pair when the corridor is live; indicative otherwise.
  const { rate, live: rateLive } = useCorridorRate(fromCcy, toCcy);
  const receive = amount > 0 ? amount * rate * (1 - FEE) : 0;
  const sameCurrency = fromCcy === toCcy;

  const swapSides = () => {
    setFromSym(toSym);
    setToSym(fromSym);
    setAmountStr("");
    setDone(false);
  };

  // Real swap when the smart wallet + matcher are wired: approve + submitIntent
  // as one gasless userOp from the USER's wallet; the solver settles it against
  // opposing flow. No wallet -> demo path so the flow always completes.
  const canExecute = smart.ready && Boolean(smart.address) && Boolean(chain.intentMatcher);

  const confirm = async () => {
    if (amount <= 0 || insufficient || sameCurrency || busy) return;
    setBusy(true);
    setError("");
    try {
      const from = tokenByCode(chain, fromCcy);
      const to = tokenByCode(chain, toCcy);
      if (canExecute && from && to) {
        const tx = await evmSwap(smart, {
          intentMatcher: chain.intentMatcher as `0x${string}`,
          tokenIn: from.address,
          tokenOut: to.address,
          amountIn: amount,
          minAmountOut: receive,
          recipient: smart.address as `0x${string}`,
          ref: `SWAP-${fromCcy}-${toCcy}`,
        });
        setTxHash(tx ?? "");
      } else {
        await new Promise((r) => setTimeout(r, 900)); // demo path
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message.split("\n")[0] : "Swap failed. Try again.");
    }
    setBusy(false);
  };

  const reset = () => {
    setDone(false);
    setAmountStr("");
    setTxHash("");
    setError("");
  };

  if (done) {
    return (
      <div className="mx-auto w-full max-w-md px-4 sm:px-6 py-10">
        <Card className="p-6 text-center">
          <span className="inline-flex w-14 h-14 rounded-full bg-sky-tint/60 items-center justify-center text-sky-deep mb-4">
            <Check className="w-7 h-7" />
          </span>
          <h2 className="text-xl font-extrabold text-harbor">
            {txHash ? "Swap submitted" : "Swap complete"}
          </h2>
          <p className="text-slate mt-1.5 text-[15px]">
            {txHash ? "Sending " : "You swapped "}
            {CURRENCIES[fromCcy].symbol}
            {formatMoney(amount, fromCcy).replace(CURRENCIES[fromCcy].symbol, "")} into{" "}
            {CURRENCIES[toCcy].symbol}
            {formatMoney(receive, toCcy).replace(CURRENCIES[toCcy].symbol, "")}
            {txHash ? ". It settles peer-to-peer the moment it's matched." : "."}
          </p>
          {txHash && (
            <a
              href={explorerTxUrl(txHash)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sky-deep font-semibold text-[13px] mt-3 hover:underline"
            >
              View transaction <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
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
        <p className="text-slate">Turn one of your currencies into another at the corridor rate.</p>
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
            <span className="text-slate">Rate {rateLive ? <span className="text-sky-deep font-semibold">· live</span> : <span className="text-slate/70">· indicative</span>}</span>
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

      {error && <p className="text-center text-[13px] text-alert mb-3">{error}</p>}

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
