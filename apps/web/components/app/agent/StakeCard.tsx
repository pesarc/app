"use client";

// The agent's in-chat market stake: it lays out the on-chain market, side and
// amount; the user affirms it's correct and taps Confirm — then it signs the
// stake with the in-app smart wallet, gaslessly, right here. No redirect to the
// Markets page. The marketId + collateral come from the LIVE on-chain market
// (resolved server-side), so the stake can't land in the wrong pool.

import { useState } from "react";
import { Check, ExternalLink, Sparkles } from "@/components/icons";
import { Button } from "@/components/app/ui";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { useActiveEvmChain } from "@pesarc/sdk/chain/activeChain";
import { evmStake } from "@pesarc/sdk/market-write";
import { publicClientFor, explorerTxUrl } from "@pesarc/sdk/chain/registry";
import { humanizeTxError } from "@pesarc/sdk/wallet/txError";
import type { StakePlan } from "@pesarc/sdk/agent/run";

export function StakeCard({ plan }: { plan: StakePlan }) {
  const smart = useSmartWallet();
  const { chain } = useActiveEvmChain();
  const [amountStr, setAmountStr] = useState(plan.amount ? String(plan.amount) : "");
  const [status, setStatus] = useState<"idle" | "signing" | "done" | "error">("idle");
  const [txHash, setTxHash] = useState<string>();
  const [err, setErr] = useState("");

  const amount = parseFloat(amountStr) || 0;
  const sideLabel = plan.side === "yes" ? "Yes" : "No";
  const predictionMarket = chain.predictionMarket;
  const canStake = smart.ready && Boolean(predictionMarket) && amount > 0 && status !== "signing";

  const confirm = async () => {
    if (!predictionMarket || amount <= 0) return;
    setErr("");
    setStatus("signing");
    try {
      const tx = await evmStake(
        smart,
        {
          predictionMarket: predictionMarket as `0x${string}`,
          collateralToken: plan.collateralToken,
          marketId: plan.marketId,
          isYes: plan.side === "yes",
          amount,
        },
        publicClientFor(chain),
      );
      if (!tx) throw new Error("The stake didn't go through.");
      setTxHash(tx);
      setStatus("done");
    } catch (e: unknown) {
      setErr(
        humanizeTxError(e, "That stake didn't go through. Please try again."),
      );
      setStatus("error");
    }
  };

  return (
    <div className="mt-3 rounded-2xl border border-sky/30 bg-sky-tint/20 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-sky" />
        <span className="text-xs font-bold uppercase tracking-widest text-sky">Confirm stake</span>
      </div>

      <div className="mb-3 rounded-xl bg-white/70 px-3 py-2.5">
        <div className="text-[14px] font-bold text-harbor">{plan.question}</div>
        <div className="mt-1 text-[13px] text-slate">
          Side: <span className="font-bold text-harbor">{sideLabel}</span>
        </div>
        <div className="mt-1 text-[12px] text-slate">
          Network: <span className="font-bold text-harbor">{chain.label}</span>
          {chain.testnet && (
            <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-amber-500">testnet</span>
          )}
          <span className="ml-1 text-slate/70">— switch it in the network selector if this is wrong.</span>
        </div>
      </div>

      {status === "done" ? (
        <div className="rounded-xl bg-white/70 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[14px] font-semibold text-harbor">
            <Check className="h-4 w-4 text-harbor" /> Staked {amount} on {sideLabel}.
          </div>
          {txHash && (
            <a
              href={explorerTxUrl(chain, txHash)}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[13px] text-sky hover:underline"
            >
              View transaction <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      ) : (
        <>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-slate mb-1.5">
            Amount
          </label>
          <input
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder="0"
            aria-label="Stake amount"
            className="mb-3 w-full rounded-xl border border-fog bg-white px-3.5 py-2.5 text-[15px] font-bold text-ink outline-none focus:border-sky numerals"
          />
          <Button onClick={confirm} block disabled={!canStake}>
            {status === "signing" ? "Signing…" : `Confirm & stake on ${sideLabel}`}
          </Button>
          {!predictionMarket && (
            <p className="mt-2 text-[12px] text-slate">Markets aren&apos;t live on this chain. Switch network.</p>
          )}
          {err && <p className="mt-2 text-[13px] text-alert">{err}</p>}
        </>
      )}
    </div>
  );
}
