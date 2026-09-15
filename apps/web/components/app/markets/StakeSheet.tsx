"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Info, Check, ArrowRight, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/app/ui";
import { type Market } from "@pesarc/sdk/markets";
import { midMarketRate, formatNumber, type CurrencyCode } from "@pesarc/sdk/money";
import { currencyOf } from "@pesarc/sdk/stablecoins";
import { activeChain, explorerTxUrl } from "@pesarc/sdk/chain/registry";
import { evmStake } from "@pesarc/sdk/market-write";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { useSolanaSigner } from "@pesarc/sdk/wallet/solana";
import { svmExplorerTx } from "@pesarc/sdk/svm/config";
import { StablecoinSelect } from "@/components/app/StablecoinSelect";
import { selectionPrice, selectionLabel, type Selection } from "./display";
import { type LiveMarket } from "@pesarc/sdk/markets.live";
import { type VenueKind } from "@pesarc/sdk/markets.venue";
import { spring } from "@/components/motion";

export default function StakeSheet({
  market,
  marketId,
  venueKind,
  selection,
  live,
  onClose,
}: {
  market: Market;
  marketId: number;
  venueKind: VenueKind;
  selection: Selection;
  live?: LiveMarket;
  onClose: () => void;
}) {
  const smart = useSmartWallet();
  const solanaSigner = useSolanaSigner();
  const [amount, setAmount] = useState("");
  const [payWith, setPayWith] = useState<string>(market.collateral); // default: the market's own stablecoin
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string>();

  // Multi-outcome markets are store-backed (the on-chain program is binary),
  // so they settle as a demo position; binary markets write on-chain.
  const isBinary = selection.kind === "binary";
  const isYes = selection.kind === "binary" && selection.side === "yes";
  const label = selectionLabel(market, selection);
  const price = selectionPrice(market, selection, live);
  const stake = Number(amount) || 0; // in the chosen stablecoin

  // The market settles in its collateral; a non-collateral stablecoin is
  // auto-swapped to it (cross-FX). All the market math is in collateral units.
  const collateralCcy = market.collateral.slice(1) as CurrencyCode; // cNGN -> NGN
  const payCcy = currencyOf(payWith);
  const needsSwap = payWith !== market.collateral;
  const stakeInCollateral = stake * midMarketRate(payCcy, collateralCcy);
  const impliedPayout = price > 0 ? (stakeInCollateral * 100) / price : 0;

  // Real write on the active venue; EVM stakes gaslessly via the smart wallet.
  const chain = activeChain();
  const collateralToken = chain.tokens[collateralCcy as "NGN" | "KES" | "GHS" | "USD"];
  const canEvm =
    isBinary && venueKind === "evm" && smart.ready && Boolean(chain.predictionMarket) && Boolean(collateralToken);

  const confirm = async () => {
    setBusy(true);
    try {
      // Only binary markets write on-chain; multi settles as a demo position.
      if (isBinary && venueKind === "evm" && canEvm && collateralToken) {
        const tx = await evmStake(smart, {
          predictionMarket: chain.predictionMarket as `0x${string}`,
          collateralToken,
          marketId,
          isYes,
          amount: stakeInCollateral,
        });
        if (tx) setTxHash(tx);
      } else if (isBinary && venueKind === "svm" && solanaSigner) {
        const { svmStake } = await import("@pesarc/sdk/svm/write");
        const sig = await svmStake(solanaSigner, {
          marketId,
          isYes,
          amount: stakeInCollateral,
        });
        setTxHash(sig);
      }
      // No signer for the active venue → demo confirmation (house live-vs-mock rule).
    } catch {
      /* never hard-fail the demo; fall through to the confirmation */
    }
    setDone(true);
    setBusy(false);
  };

  const txUrl = txHash
    ? venueKind === "svm"
      ? svmExplorerTx(txHash)
      : explorerTxUrl(chain, txHash)
    : "";

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
            <div className="text-xs font-semibold uppercase tracking-widest text-slate">
              Backing {label} · {price}¢
            </div>
            <p className="font-semibold text-ink leading-snug mt-1">
              {market.question}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate hover:text-ink p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="py-6 text-center">
            <span className="inline-flex w-12 h-12 rounded-full bg-sky/15 items-center justify-center text-sky mb-3">
              <Check className="w-6 h-6" />
            </span>
            <p className="font-semibold text-ink">{label} position placed</p>
            <p className="text-sm text-slate mt-1">
              {payWith} {stake.toLocaleString()} staked
              {needsSwap ? ` (→ ${market.collateral} ${Math.round(stakeInCollateral).toLocaleString()})` : ""}
              {" "}· settles {market.resolves} from{" "}
              {market.resolver.kind === "oracle"
                ? "the realized rate"
                : "an attested print"}
              .
            </p>
            {txHash && (
              <a
                href={txUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-sm font-semibold text-sky hover:underline"
              >
                View on-chain <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <Button block className="mt-5" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-3">
              <StablecoinSelect value={payWith} onChange={setPayWith} label="Stake with" />
            </div>

            <label className="block text-xs font-medium text-slate mb-1.5">
              Amount ({payWith})
            </label>
            <div className="flex items-center rounded-xl border border-fog bg-snow px-4 py-3 mb-2">
              <span className="text-slate mr-2 text-sm">{payWith}</span>
              <input
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0"
                className="flex-1 bg-transparent outline-none text-xl font-semibold text-ink numerals"
              />
            </div>

            <div className="flex gap-2 mb-3">
              {[5000, 20000, 50000].map((q) => (
                <button
                  key={q}
                  onClick={() => setAmount(String(q))}
                  className="flex-1 rounded-lg bg-black/[0.04] hover:bg-black/[0.07] py-1.5 text-xs font-medium text-ink transition-colors"
                >
                  {q.toLocaleString()}
                </button>
              ))}
            </div>

            {needsSwap && stake > 0 && (
              <div className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-sky-deep mb-3">
                {payWith} {formatNumber(stake, payCcy)}
                <ArrowRight className="w-3.5 h-3.5" />
                {market.collateral} {formatNumber(stakeInCollateral, collateralCcy)}
                <span className="text-slate font-medium">· auto-swapped</span>
              </div>
            )}

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
              <p className="flex items-start gap-2 text-[11px] text-slate mb-4">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-sky" />
                This is a hedge, not a bet — it pays out to offset the real-world
                move, in your own currency.
              </p>
            )}

            <Button
              block
              size="lg"
              disabled={stake <= 0 || busy}
              onClick={confirm}
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Staking…
                </>
              ) : stake > 0 ? (
                `Stake ${payWith} ${stake.toLocaleString()} on ${label}`
              ) : (
                "Enter an amount"
              )}
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
      <span className="text-slate">{label}</span>
      <span
        className={`font-semibold numerals ${
          accent ? "text-sky" : "text-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
